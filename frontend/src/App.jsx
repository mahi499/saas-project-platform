import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import "./App.css";

const API_BASE = "/api";

const COLUMNS = [
  { id: "TODO", title: "To do", color: "todo" },
  { id: "IN_PROGRESS", title: "In progress", color: "progress" },
  { id: "DONE", title: "Done", color: "done" },
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

function readCookie(name) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Obtain a fresh CSRF cookie before every write request.
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfResponse = await fetch(`${API_BASE}/csrf/`, {
      credentials: "include",
    });
    if (!csrfResponse.ok) {
      throw new Error("Could not prepare the security token. Check that Django is running.");
    }
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    body:
      options.body !== undefined && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });

  if (response.status === 204) return null;

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Permission denied. Your workspace role may not allow this action, or your session may need to be refreshed."
      );
    }
    if (response.status === 401) {
      throw new Error("You are not authenticated. Sign in to Django before changing tasks.");
    }
    if (typeof data === "string" && data) throw new Error(data);
    if (data && typeof data === "object") {
      const message = Object.entries(data)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : JSON.stringify(value)}`)
        .join(" · ");
      throw new Error(message || `Request failed (${response.status}).`);
    }
    throw new Error(`Request failed (${response.status}).`);
  }

  return data;
}

function normaliseTask(task, projects) {
  const projectId = Number(task.project ?? task.project_id);
  const project = projects.find((item) => Number(item.id) === projectId);
  return {
    id: Number(task.id),
    title: task.title || "",
    description: task.description || "",
    status: task.status || "TODO",
    priority: task.priority || "MEDIUM",
    projectId,
    projectName: task.project_name || project?.name || "Project",
    assignee:
      task.assigned_to_username ||
      task.assigned_to_name ||
      task.assigned_to?.username ||
      "",
  };
}

function DraggableTaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? "task-card-dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="task-card-topline">
        <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
          {task.priority}
        </span>
        <div className="task-card-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`Edit ${task.title}`}
            title="Edit task"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(task);
            }}
          >
            ✎
          </button>
          <button
            type="button"
            className="icon-button delete-button"
            aria-label={`Delete ${task.title}`}
            title="Delete task"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(task);
            }}
          >
            ×
          </button>
        </div>
      </div>

      <h3 className="task-title">{task.title}</h3>
      {task.description && <p className="task-description">{task.description}</p>}
      <div className="task-card-meta">
        <span className="project-label">{task.projectName}</span>
        {task.assignee && <span className="assignee-label">{task.assignee}</span>}
      </div>
      <label className="status-select-label">
        <span>Move to</span>
        <select
          className="task-status-control"
          value={task.status}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            onStatusChange(task.id, event.target.value);
          }}
        >
          {COLUMNS.map((column) => (
            <option value={column.id} key={column.id}>
              {column.title}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function DroppableColumn({ column, tasks, onEdit, onDelete, onStatusChange, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? "column-drag-over" : ""}`}
    >
      <div className="column-heading">
        <div className="column-title-wrap">
          <span className={`column-dot dot-${column.color}`} />
          <h2>{column.title}</h2>
          <span className="column-count">{tasks.length}</span>
        </div>
        <button className="column-add-button" type="button" onClick={() => onAdd(column.id)} aria-label={`Add task to ${column.title}`}>
          +
        </button>
      </div>
      <div className="column-task-list">
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 && (
          <div className="empty-column">Drop a task here or add a new one.</div>
        )}
      </div>
      <button className="add-task-inline" type="button" onClick={() => onAdd(column.id)}>
        + Add task
      </button>
    </section>
  );
}

const EMPTY_PROJECT_FORM = { id: null, name: "", description: "", workspace: "" };
const EMPTY_WORKSPACE_FORM = { name: "", slug: "" };

const EMPTY_FORM = {
  id: null,
  title: "",
  description: "",
  project: "",
  priority: "MEDIUM",
  status: "TODO",
};

export default function App() {
  const [authStatus, setAuthStatus] = useState("checking");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState(EMPTY_WORKSPACE_FORM);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [projectSaving, setProjectSaving] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [newMember, setNewMember] = useState({ user: "", role: "MEMBER" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [workspaceData, projectData, taskData] = await Promise.all([
        apiRequest("/workspaces/"),
        apiRequest("/projects/"),
        apiRequest("/tasks/"),
      ]);

      const nextWorkspaces = Array.isArray(workspaceData)
        ? workspaceData
        : workspaceData?.results || [];
      const nextProjects = Array.isArray(projectData)
        ? projectData
        : projectData?.results || [];
      const nextTasks = Array.isArray(taskData)
        ? taskData
        : taskData?.results || [];

      setWorkspaces(nextWorkspaces);
      setProjects(nextProjects);
      setTasks(nextTasks.map((task) => normaliseTask(task, nextProjects)));

      setSelectedWorkspaceId((current) => {
        if (current && nextWorkspaces.some((item) => String(item.id) === String(current))) {
          return String(current);
        }
        return nextWorkspaces.length ? String(nextWorkspaces[0].id) : "";
      });
    } catch (error) {
      setLoadError(error.message || "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await apiRequest("/workspaces/");
        if (!active) return;
        setAuthStatus("authenticated");
        await loadData();
      } catch {
        if (!active) return;
        setAuthStatus("unauthenticated");
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadData]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    const username = authForm.username.trim();
    if (!username || !authForm.password || (authMode === "register" && !authForm.email.trim())) {
      setAuthError(authMode === "register" ? "Enter a username, email, and password." : "Enter your username and password.");
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "register") {
        await apiRequest("/register/", {
          method: "POST",
          body: { username, email: authForm.email.trim(), password: authForm.password },
        });
        setAuthMode("login");
        setAuthForm({ username, email: "", password: "" });
        setAuthNotice("Account created. Please sign in with your new credentials.");
      } else {
        const result = await apiRequest("/login/", {
          method: "POST",
          body: { username, password: authForm.password },
        });
        setCurrentUser(result?.user || { username });
        setAuthStatus("authenticated");
        setAuthForm({ username: "", email: "", password: "" });
        await loadData();
      }
    } catch (error) {
      setAuthError(error.message || "Authentication failed. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  function openCreateWorkspaceModal() {
    setActionError("");
    setWorkspaceForm(EMPTY_WORKSPACE_FORM);
    setWorkspaceModalOpen(true);
  }

  async function handleCreateWorkspace(event) {
    event.preventDefault();
    setActionError("");
    setNotice("");
    const name = workspaceForm.name.trim();
    const slug = (workspaceForm.slug.trim() || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!name) {
      setActionError("Enter a workspace name.");
      return;
    }
    if (!slug) {
      setActionError("Enter a valid workspace name or slug.");
      return;
    }

    setWorkspaceSaving(true);
    try {
      const created = await apiRequest("/workspaces/", {
        method: "POST",
        body: { name, slug },
      });
      const createdId = created?.id;
      setWorkspaceModalOpen(false);
      setWorkspaceForm(EMPTY_WORKSPACE_FORM);
      await loadData();
      if (createdId !== undefined && createdId !== null) {
        setSelectedWorkspaceId(String(createdId));
      }
      setNotice(`Workspace “${created?.name || name}” created successfully. You are its owner.`);
    } catch (error) {
      setActionError(error.message || "Could not create the workspace.");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/logout/", { method: "POST", body: {} });
    } catch (error) {
      setActionError(error.message || "Could not log out.");
      return;
    }
    setCurrentUser(null);
    setWorkspaces([]);
    setProjects([]);
    setTasks([]);
    setSelectedWorkspaceId("");
    setAuthMode("login");
    setAuthStatus("unauthenticated");
    setAuthNotice("You have been signed out.");
    setAuthError("");
  }

  useEffect(() => {
    if (!notice && !actionError) return undefined;
    const timeout = window.setTimeout(() => {
      setNotice("");
      setActionError("");
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [notice, actionError]);

  const visibleProjects = useMemo(
    () => projects.filter((project) => String(project.workspace) === String(selectedWorkspaceId) ||
      String(project.workspace_id) === String(selectedWorkspaceId)),
    [projects, selectedWorkspaceId]
  );

  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((project) => Number(project.id))),
    [visibleProjects]
  );

  const visibleTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return tasks.filter((task) => {
      const inWorkspace = visibleProjectIds.has(Number(task.projectId));
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.projectName.toLowerCase().includes(query);
      return inWorkspace && matchesSearch;
    });
  }, [tasks, visibleProjectIds, searchText]);

  const selectedWorkspace = workspaces.find(
    (workspace) => String(workspace.id) === String(selectedWorkspaceId)
  );

  function openCreateModal(status = "TODO") {
    setActionError("");
    setForm({
      ...EMPTY_FORM,
      status,
      project: visibleProjects.length ? String(visibleProjects[0].id) : "",
    });
    setModalOpen(true);
  }

  function openEditModal(task) {
    setActionError("");
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      project: String(task.projectId),
      priority: task.priority,
      status: task.status,
    });
    setModalOpen(true);
  }

  function openCreateProjectModal() {
    setActionError("");
    setProjectForm({
      ...EMPTY_PROJECT_FORM,
      workspace: selectedWorkspaceId || (workspaces[0] ? String(workspaces[0].id) : ""),
    });
    setProjectModalOpen(true);
  }

  function openEditProjectModal(project) {
    setActionError("");
    setProjectForm({
      id: project.id,
      name: project.name || "",
      description: project.description || "",
      workspace: String(project.workspace ?? project.workspace_id ?? selectedWorkspaceId),
    });
    setProjectModalOpen(true);
  }

  async function handleSaveProject(event) {
    event.preventDefault();
    setActionError("");
    setNotice("");

    if (!projectForm.name.trim()) {
      setActionError("Please enter a project name.");
      return;
    }
    if (!projectForm.workspace) {
      setActionError("Please select a workspace.");
      return;
    }

    setProjectSaving(true);
    const payload = {
      name: projectForm.name.trim(),
      description: projectForm.description.trim(),
      workspace: Number(projectForm.workspace),
    };

    try {
      if (projectForm.id) {
        await apiRequest(`/projects/${projectForm.id}/`, {
          method: "PUT",
          body: payload,
        });
        setNotice("Project updated successfully.");
      } else {
        await apiRequest("/projects/", { method: "POST", body: payload });
        setNotice("Project created successfully.");
      }
      setProjectModalOpen(false);
      setProjectForm(EMPTY_PROJECT_FORM);
      await loadData();
    } catch (error) {
      setActionError(error.message || "Could not save the project.");
    } finally {
      setProjectSaving(false);
    }
  }

  async function handleDeleteProject(project) {
    const confirmed = window.confirm(
      `Delete project "${project.name}"? This may also delete its tasks and cannot be undone.`
    );
    if (!confirmed) return;

    setActionError("");
    setNotice("");
    try {
      await apiRequest(`/projects/${project.id}/`, { method: "DELETE" });
      setNotice("Project deleted successfully.");
      await loadData();
    } catch (error) {
      setActionError(error.message || "Could not delete the project.");
    }
  }

  async function openMembersModal() {
    if (!selectedWorkspaceId) {
      setActionError("Select a workspace first.");
      return;
    }
    setActionError("");
    setNotice("");
    setMembersModalOpen(true);
    setMembersLoading(true);
    try {
      const data = await apiRequest(`/workspaces/${selectedWorkspaceId}/members/`);
      setMembers(Array.isArray(data) ? data : data?.results || []);
    } catch (error) {
      setMembers([]);
      setActionError(error.message || "Could not load workspace members.");
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    const userId = Number(newMember.user);
    if (!Number.isInteger(userId) || userId <= 0) {
      setActionError("Enter a valid existing Django user ID.");
      return;
    }
    setMemberSaving(true);
    setActionError("");
    setNotice("");
    try {
      const created = await apiRequest(`/workspaces/${selectedWorkspaceId}/members/`, {
        method: "POST",
        body: { user: userId, role: newMember.role },
      });
      setMembers((current) => [...current, created]);
      setNewMember({ user: "", role: "MEMBER" });
      setNotice(`Added ${created.username || "the user"} to this workspace.`);
    } catch (error) {
      setActionError(error.message || "Could not add this member.");
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleMemberRoleChange(membership, role) {
    if (membership.role === role) return;
    setMemberSaving(true);
    setActionError("");
    setNotice("");
    try {
      const updated = await apiRequest(`/workspaces/${selectedWorkspaceId}/members/`, {
        method: "PATCH",
        body: { membership_id: membership.id, role },
      });
      setMembers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Updated ${updated.username || "member"}'s role.`);
    } catch (error) {
      setActionError(error.message || "Could not update this role.");
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleRemoveMember(membership) {
    if (!window.confirm(`Remove ${membership.username || "this user"} from this workspace?`)) return;
    setMemberSaving(true);
    setActionError("");
    setNotice("");
    try {
      await apiRequest(`/workspaces/${selectedWorkspaceId}/members/`, {
        method: "DELETE",
        body: { membership_id: membership.id },
      });
      setMembers((current) => current.filter((item) => item.id !== membership.id));
      setNotice(`${membership.username || "Member"} removed from this workspace.`);
    } catch (error) {
      setActionError(error.message || "Could not remove this member.");
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleSaveTask(event) {
    event.preventDefault();
    setActionError("");
    setNotice("");

    if (!form.title.trim()) {
      setActionError("Please enter a task title.");
      return;
    }
    if (!form.project) {
      setActionError("Create or select a project before adding a task.");
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      project: Number(form.project),
      priority: form.priority,
      status: form.status,
    };

    try {
      if (form.id) {
        const updated = await apiRequest(`/tasks/${form.id}/`, {
          method: "PATCH",
          body: payload,
        });
        setTasks((current) =>
          current.map((task) =>
            task.id === Number(form.id)
              ? normaliseTask(updated, projects)
              : task
          )
        );
        setNotice("Task updated successfully.");
      } else {
        const created = await apiRequest("/tasks/", {
          method: "POST",
          body: payload,
        });
        setTasks((current) => [...current, normaliseTask(created, projects)]);
        setNotice("Task created successfully.");
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (error) {
      setActionError(error.message || "Could not save the task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(task) {
    const confirmed = window.confirm(`Delete "${task.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setActionError("");
    setNotice("");
    try {
      await apiRequest(`/tasks/${task.id}/`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setNotice("Task deleted successfully.");
    } catch (error) {
      setActionError(error.message || "Could not delete the task.");
    }
  }

  async function handleStatusChange(taskId, nextStatus) {
    const task = tasks.find((item) => item.id === Number(taskId));
    if (!task || task.status === nextStatus) return;

    setActionError("");
    const previousStatus = task.status;
    setTasks((current) =>
      current.map((item) =>
        item.id === Number(taskId) ? { ...item, status: nextStatus } : item
      )
    );

    try {
      const updated = await apiRequest(`/tasks/${taskId}/`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      setTasks((current) =>
        current.map((item) =>
          item.id === Number(taskId)
            ? normaliseTask(updated, projects)
            : item
        )
      );
      setNotice("Task status saved.");
    } catch (error) {
      setTasks((current) =>
        current.map((item) =>
          item.id === Number(taskId) ? { ...item, status: previousStatus } : item
        )
      );
      setActionError(error.message || "Could not update the task status.");
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const nextStatus = COLUMNS.find((column) => column.id === String(over.id));
    if (nextStatus) handleStatusChange(Number(active.id), nextStatus.id);
  }

  const todoCount = visibleTasks.filter((task) => task.status === "TODO").length;
  const progressCount = visibleTasks.filter((task) => task.status === "IN_PROGRESS").length;
  const doneCount = visibleTasks.filter((task) => task.status === "DONE").length;

  if (authStatus === "checking") {
    return <main className="auth-page"><div className="auth-card auth-loading"><div className="auth-brand-mark">P</div><h1>ProjectFlow</h1><p>Checking your session…</p></div></main>;
  }

  if (authStatus === "unauthenticated") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand-mark">P</div>
          <p className="auth-eyebrow">YOUR TEAM, IN FLOW</p>
          <h1>{authMode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-subtitle">{authMode === "login" ? "Sign in to continue to your workspace." : "Get started with your ProjectFlow workspace."}</p>
          {authError && <div className="auth-message auth-error" role="alert">{authError}</div>}
          {authNotice && <div className="auth-message auth-success" role="status">{authNotice}</div>}
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>Username<input autoComplete="username" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} placeholder="Enter your username" required /></label>
            {authMode === "register" && <label>Email address<input type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" required /></label>}
            <label>Password<input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder={authMode === "register" ? "At least 8 characters" : "Enter your password"} minLength={authMode === "register" ? 8 : undefined} required /></label>
            <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="auth-switch">{authMode === "login" ? "New to ProjectFlow?" : "Already have an account?"} <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); setAuthNotice(""); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
          <p className="auth-security">Secure sign-in powered by Django sessions.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <span>ProjectFlow</span>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">WORKSPACE</p>
          <label className="workspace-select-wrap">
            <span className="workspace-avatar">
              {(selectedWorkspace?.name || "W").slice(0, 1).toUpperCase()}
            </span>
            <select
              className="workspace-select"
              value={selectedWorkspaceId}
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
              aria-label="Choose workspace"
            >
              {workspaces.map((workspace) => (
                <option value={workspace.id} key={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="create-workspace-button"
            type="button"
            onClick={openCreateWorkspaceModal}
          >
            <span>＋</span> Create workspace
          </button>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-label">MENU</p>
          <button className="nav-item active" type="button">
            <span>▦</span> Project board
          </button>
          <div className="nav-heading">
            <span>Projects</span>
            <span>{visibleProjects.length}</span>
          </div>
          {visibleProjects.map((project) => (
            <div className="project-nav-item" key={project.id} title={project.name}>
              <span className="project-nav-dot" />
              <span className="project-nav-name">{project.name}</span>
              <span className="project-nav-actions">
                <button type="button" title={`Edit ${project.name}`} aria-label={`Edit ${project.name}`} onClick={() => openEditProjectModal(project)}>✎</button>
                <button type="button" title={`Delete ${project.name}`} aria-label={`Delete ${project.name}`} onClick={() => handleDeleteProject(project)}>×</button>
              </span>
            </div>
          ))}
          {!loading && visibleProjects.length === 0 && (
            <p className="sidebar-empty">No projects in this workspace.</p>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>
            <div>
              <strong>Need a hand?</strong>
              <p>Keep your team moving.</p>
            </div>
          </div>
          <div className="sidebar-footer">
            <div className="profile-avatar">M</div>
            <div className="profile-copy">
              <strong>Workspace member</strong>
              <span>ProjectFlow</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span><span className="breadcrumb-separator">/</span>
            <strong>Project board</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <span>⌕</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="topbar-icon-button" type="button" title="Refresh tasks" onClick={loadData}>↻</button>
            <span className="signed-in-user">{currentUser?.username || "Signed in"}</span>
            <button className="secondary-button sign-out-button" type="button" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading-row">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>{selectedWorkspace?.name || "Your workspace"}</h1>
              <p className="page-subtitle">Plan, track, and deliver work with your team.</p>
            </div>
            <div className="heading-actions">
              <button className="secondary-button" type="button" onClick={openMembersModal} disabled={!selectedWorkspaceId}>
                <span>♙</span> Members
              </button>
              <button className="secondary-button" type="button" onClick={openCreateProjectModal}>
                <span>＋</span> Create project
              </button>
              <button className="primary-button" type="button" onClick={() => openCreateModal("TODO")}>
                <span>＋</span> Create task
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple">▦</div>
              <div><p>Total tasks</p><strong>{visibleTasks.length}</strong></div>
              <span className="stat-footnote">In this workspace</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-orange">◷</div>
              <div><p>To do</p><strong>{todoCount}</strong></div>
              <span className="stat-footnote">Waiting to start</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue">↗</div>
              <div><p>In progress</p><strong>{progressCount}</strong></div>
              <span className="stat-footnote">Currently active</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green">✓</div>
              <div><p>Completed</p><strong>{doneCount}</strong></div>
              <span className="stat-footnote">Finished tasks</span>
            </div>
          </div>

          {notice && <div className="toast toast-success" role="status">{notice}</div>}
          {actionError && <div className="toast toast-error" role="alert">{actionError}</div>}

          <div className="board-heading">
            <div>
              <h2>Task board</h2>
              <p>Drag tasks between columns to update their status.</p>
            </div>
            <span className="board-task-count">{visibleTasks.length} tasks</span>
          </div>

          {loading ? (
            <div className="state-panel"><div className="spinner" />Loading your workspace...</div>
          ) : loadError ? (
            <div className="state-panel state-error">
              <strong>Could not load your tasks</strong>
              <p>{loadError}</p>
              <button className="primary-button" type="button" onClick={loadData}>Try again</button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="kanban-board">
                {COLUMNS.map((column) => (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    tasks={visibleTasks.filter((task) => task.status === column.id)}
                    onEdit={openEditModal}
                    onDelete={handleDeleteTask}
                    onStatusChange={handleStatusChange}
                    onAdd={openCreateModal}
                  />
                ))}
              </div>
            </DndContext>
          )}

          <p className="board-tip">Tip: You can also change a task's status from the “Move to” menu on each card.</p>
        </div>
      </section>

      {workspaceModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !workspaceSaving) setWorkspaceModalOpen(false);
        }}>
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">WORKSPACE SETUP</p>
                <h2 id="workspace-modal-title">Create a workspace</h2>
                <p className="modal-subtitle">Create a separate space for a team, company, or project group.</p>
              </div>
              <button className="modal-close" type="button" onClick={() => setWorkspaceModalOpen(false)} disabled={workspaceSaving} aria-label="Close modal">×</button>
            </div>

            {actionError && <div className="form-error" role="alert">{actionError}</div>}

            <form className="task-form" onSubmit={handleCreateWorkspace}>
              <label>
                Workspace name <span className="required">*</span>
                <input
                  value={workspaceForm.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setWorkspaceForm((current) => ({
                      ...current,
                      name,
                      slug: current.slug === "" || current.slug === current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
                        ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
                        : current.slug,
                    }));
                  }}
                  placeholder="e.g. Testing Workspace"
                  required
                  maxLength={100}
                  autoFocus
                />
              </label>
              <label>
                Workspace slug
                <input
                  value={workspaceForm.slug}
                  onChange={(event) => setWorkspaceForm({ ...workspaceForm, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") })}
                  placeholder="e.g. testing-workspace"
                />
                <small>Used as a unique identifier. If left blank, it is generated from the name.</small>
              </label>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setWorkspaceModalOpen(false)} disabled={workspaceSaving}>Cancel</button>
                <button className="primary-button" type="submit" disabled={workspaceSaving}>{workspaceSaving ? "Creating…" : "Create workspace"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {membersModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !memberSaving) setMembersModalOpen(false);
        }}>
          <section className="task-modal members-modal" role="dialog" aria-modal="true" aria-labelledby="members-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">WORKSPACE TEAM</p>
                <h2 id="members-modal-title">Manage members</h2>
                <p className="modal-subtitle">{selectedWorkspace?.name || "Selected workspace"} · {members.length} member{members.length === 1 ? "" : "s"}</p>
              </div>
              <button className="modal-close" type="button" onClick={() => setMembersModalOpen(false)} disabled={memberSaving} aria-label="Close modal">×</button>
            </div>

            {actionError && <div className="form-error" role="alert">{actionError}</div>}
            {notice && <div className="members-notice" role="status">{notice}</div>}

            <form className="task-form member-add-form" onSubmit={handleAddMember}>
              <label>
                Existing Django user ID <span className="required">*</span>
                <input
                  type="number"
                  min="1"
                  value={newMember.user}
                  onChange={(event) => setNewMember({ ...newMember, user: event.target.value })}
                  placeholder="e.g. 3"
                  required
                />
                <small>Add an existing user account by its numeric database ID. Email invitations are not implemented yet.</small>
              </label>
              <label>
                Role
                <select value={newMember.role} onChange={(event) => setNewMember({ ...newMember, role: event.target.value })}>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <button className="primary-button member-add-button" type="submit" disabled={memberSaving}>
                {memberSaving ? "Please wait…" : "＋ Add member"}
              </button>
            </form>

            <div className="members-list-heading"><strong>Current members</strong><span>Role changes save immediately</span></div>
            {membersLoading ? (
              <div className="members-empty">Loading workspace members…</div>
            ) : members.length === 0 ? (
              <div className="members-empty">No members found, or you do not have permission to view them.</div>
            ) : (
              <div className="members-list">
                {members.map((membership) => (
                  <div className="member-row" key={membership.id}>
                    <div className="member-avatar">{(membership.username || "?").slice(0, 1).toUpperCase()}</div>
                    <div className="member-identity">
                      <strong>{membership.username || `User ${membership.user}`}</strong>
                      <span>User ID: {membership.user}</span>
                    </div>
                    {membership.role === "OWNER" ? (
                      <span className="member-role owner-role">Owner</span>
                    ) : (
                      <>
                        <select
                          className="member-role-select"
                          value={membership.role}
                          aria-label={`Role for ${membership.username}`}
                          disabled={memberSaving}
                          onChange={(event) => handleMemberRoleChange(membership, event.target.value)}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button
                          className="member-remove-button"
                          type="button"
                          disabled={memberSaving}
                          onClick={() => handleRemoveMember(membership)}
                          aria-label={`Remove ${membership.username}`}
                          title="Remove member"
                        >×</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setMembersModalOpen(false)} disabled={memberSaving}>Close</button>
            </div>
          </section>
        </div>
      )}

      {projectModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !projectSaving) setProjectModalOpen(false);
        }}>
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{projectForm.id ? "UPDATE PROJECT" : "NEW PROJECT"}</p>
                <h2 id="project-modal-title">{projectForm.id ? "Edit project" : "Create a project"}</h2>
                <p className="modal-subtitle">Organize tasks under a project in your workspace.</p>
              </div>
              <button className="modal-close" type="button" onClick={() => setProjectModalOpen(false)} disabled={projectSaving} aria-label="Close modal">×</button>
            </div>

            {actionError && <div className="form-error" role="alert">{actionError}</div>}

            <form className="task-form" onSubmit={handleSaveProject}>
              <label>
                Project name <span className="required">*</span>
                <input
                  autoFocus
                  value={projectForm.name}
                  onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                  placeholder="e.g. Customer Portal"
                  maxLength={200}
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  value={projectForm.description}
                  onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
                  placeholder="What is this project about?"
                  rows={4}
                />
              </label>

              <label>
                Workspace <span className="required">*</span>
                <select
                  value={projectForm.workspace}
                  onChange={(event) => setProjectForm({ ...projectForm, workspace: event.target.value })}
                  required
                  disabled={Boolean(projectForm.id)}
                >
                  <option value="">Select a workspace</option>
                  {workspaces.map((workspace) => (
                    <option value={workspace.id} key={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
                {projectForm.id && <small>Projects cannot be moved to another workspace here.</small>}
              </label>

              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setProjectModalOpen(false)} disabled={projectSaving}>Cancel</button>
                <button className="primary-button" type="submit" disabled={projectSaving || !workspaces.length}>
                  {projectSaving ? "Saving..." : projectForm.id ? "Save changes" : "Create project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{form.id ? "UPDATE TASK" : "NEW TASK"}</p>
                <h2 id="task-modal-title">{form.id ? "Edit task" : "Create a task"}</h2>
                <p className="modal-subtitle">Add the details your team needs to get moving.</p>
              </div>
              <button className="modal-close" type="button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close modal">×</button>
            </div>

            {actionError && <div className="form-error" role="alert">{actionError}</div>}

            <form className="task-form" onSubmit={handleSaveTask}>
              <label>
                Task title <span className="required">*</span>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Build project dashboard"
                  maxLength={200}
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Add context, acceptance criteria, or notes..."
                  rows={4}
                />
              </label>

              <div className="form-two-columns">
                <label>
                  Project <span className="required">*</span>
                  <select
                    value={form.project}
                    onChange={(event) => setForm({ ...form, project: event.target.value })}
                    required
                  >
                    <option value="">Select a project</option>
                    {visibleProjects.map((project) => (
                      <option value={project.id} key={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  >
                    {PRIORITIES.map((priority) => <option value={priority} key={priority}>{priority}</option>)}
                  </select>
                </label>
              </div>

              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  {COLUMNS.map((column) => <option value={column.id} key={column.id}>{column.title}</option>)}
                </select>
              </label>

              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="primary-button" type="submit" disabled={saving || !visibleProjects.length}>
                  {saving ? "Saving..." : form.id ? "Save changes" : "Create task"}
                </button>
              </div>
              {!visibleProjects.length && (
                <p className="no-project-warning">There are no projects in this workspace. Create a project first.</p>
              )}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

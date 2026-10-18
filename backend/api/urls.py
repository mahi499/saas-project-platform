from django.urls import path

from .views import (
    csrf_token,
    health_check,
    register_user,
    login_user,
    logout_user,
    workspace_list,
    workspace_detail,
    workspace_members,
    project_list,
    project_detail,
    task_list,
    task_detail,
)

urlpatterns = [
    # CSRF protection
    path("csrf/", csrf_token, name="csrf_token"),

    # Health check
    path("health/", health_check, name="health-check"),

    # Workspaces
    path("workspaces/", workspace_list, name="workspace-list"),
    path(
        "workspaces/<int:pk>/",
        workspace_detail,
        name="workspace-detail",
    ),

    # Workspace members
    path(
        "workspaces/<int:workspace_id>/members/",
        workspace_members,
        name="workspace-members",
    ),

    # Projects: list, create, retrieve, update, delete
    path("projects/", project_list, name="project-list"),
    path(
        "projects/<int:pk>/",
        project_detail,
        name="project-detail",
    ),

    # Tasks: list, create, retrieve, update, delete
    path("tasks/", task_list, name="task-list"),
    path(
        "tasks/<int:pk>/",
        task_detail,
        name="task-detail",
    ),
        # Authentication
    path("register/", register_user, name="register"),
    path("login/", login_user, name="login"),
    path("logout/", logout_user, name="logout"),
]
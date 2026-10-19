from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib.auth.models import User

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Workspace, WorkspaceMembership, Project, Task
from .serializers import (
    WorkspaceSerializer,
    WorkspaceMembershipSerializer,
    ProjectSerializer,
    TaskSerializer,
)
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({"message": "CSRF cookie set"})


# --------------------------------------------------
# 1. HEALTH CHECK
# GET /api/health/
# --------------------------------------------------

@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({
        "status": "success",
        "message": "SaaS Project Management API is running!"
    })


# --------------------------------------------------
# 2. LIST AND CREATE WORKSPACES
# GET  /api/workspaces/
# POST /api/workspaces/
# --------------------------------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def workspace_list(request):

    # Return only workspaces the logged-in user belongs to
    if request.method == "GET":

        workspaces = Workspace.objects.filter(
            memberships__user=request.user
        ).distinct()

        serializer = WorkspaceSerializer(
            workspaces,
            many=True
        )

        return Response(serializer.data)

    # Create a workspace and automatically assign ownership
    elif request.method == "POST":

        serializer = WorkspaceSerializer(
            data=request.data
        )

        if serializer.is_valid():

            workspace = serializer.save()

            WorkspaceMembership.objects.create(
                user=request.user,
                workspace=workspace,
                role=WorkspaceMembership.Role.OWNER
            )

            return Response(
                WorkspaceSerializer(workspace).data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


# --------------------------------------------------
# 3. RETRIEVE, UPDATE, AND DELETE A WORKSPACE
# GET    /api/workspaces/<id>/
# PUT    /api/workspaces/<id>/
# DELETE /api/workspaces/<id>/
# --------------------------------------------------

@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def workspace_detail(request, pk):

    # Users can only access their own workspaces
    try:
        membership = WorkspaceMembership.objects.select_related(
            "workspace"
        ).get(
            workspace_id=pk,
            user=request.user
        )

        workspace = membership.workspace

    except WorkspaceMembership.DoesNotExist:
        return Response(
            {
                "error": "Workspace not found or you do not have access"
            },
            status=status.HTTP_404_NOT_FOUND
        )

    # Retrieve workspace
    if request.method == "GET":

        serializer = WorkspaceSerializer(workspace)

        return Response(serializer.data)

    # Only owners and admins can update or delete workspaces
    if membership.role not in [
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    ]:
        return Response(
            {
                "error": "You do not have permission to modify this workspace"
            },
            status=status.HTTP_403_FORBIDDEN
        )

    # Update workspace
    if request.method == "PUT":

        serializer = WorkspaceSerializer(
            workspace,
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # Delete workspace
    elif request.method == "DELETE":

        if membership.role != WorkspaceMembership.Role.OWNER:
            return Response(
                {
                    "error": "Only the workspace owner can delete the workspace"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        workspace.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


# --------------------------------------------------
# 4. LIST AND ADD WORKSPACE MEMBERS
# GET  /api/workspaces/<workspace_id>/members/
# POST /api/workspaces/<workspace_id>/members/
# --------------------------------------------------

@api_view(["GET", "POST", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def workspace_members(request, workspace_id):

    # Find the current user's membership in this workspace.
    try:
        current_membership = WorkspaceMembership.objects.get(
            user=request.user,
            workspace_id=workspace_id
        )

    except WorkspaceMembership.DoesNotExist:
        return Response(
            {"error": "Workspace not found or you do not have access"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Only owners and admins can manage members.
    if current_membership.role not in [
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    ]:
        return Response(
            {"error": "You do not have permission to manage members"},
            status=status.HTTP_403_FORBIDDEN
        )

    # GET: List members.
    if request.method == "GET":

        memberships = (
            WorkspaceMembership.objects
            .filter(workspace_id=workspace_id)
            .select_related("user")
        )

        serializer = WorkspaceMembershipSerializer(
            memberships,
            many=True
        )

        return Response(serializer.data)

    # POST: Add a member.
    elif request.method == "POST":

        user_id = request.data.get("user")
        role = request.data.get(
            "role",
            WorkspaceMembership.Role.MEMBER
        )

        # Only the owner can assign the OWNER role.
        allowed_roles = [
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.MEMBER,
        ]

        if role not in allowed_roles:
            return Response(
                {"error": "Only ADMIN or MEMBER roles can be assigned here"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find the user to add.
        try:
            user = User.objects.get(pk=user_id)

        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {"error": "A valid user ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Add the user if they aren't already a member.
        membership, created = (
            WorkspaceMembership.objects.get_or_create(
                user=user,
                workspace_id=workspace_id,
                defaults={"role": role}
            )
        )

        if not created:
            return Response(
                {"error": "This user is already a member of the workspace"},
                status=status.HTTP_409_CONFLICT
            )

        return Response(
            WorkspaceMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED
        )

       # PATCH: Change a member's role.
    elif request.method == "PATCH":

        membership_id = request.data.get("membership_id")
        new_role = request.data.get("role")

        if not membership_id or not new_role:
            return Response(
                {"error": "membership_id and role are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target = WorkspaceMembership.objects.get(
                pk=membership_id,
                workspace_id=workspace_id
            )

        except (
            WorkspaceMembership.DoesNotExist,
            ValueError,
            TypeError
        ):
            return Response(
                {"error": "Membership not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Never allow anyone to change the owner's role.
        if target.role == WorkspaceMembership.Role.OWNER:
            return Response(
                {
                    "error": "The workspace owner's role cannot be changed here"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Only the workspace owner can change an admin's role.
        if (
            target.role == WorkspaceMembership.Role.ADMIN
            and current_membership.role != WorkspaceMembership.Role.OWNER
        ):
            return Response(
                {
                    "error": (
                        "Only the workspace owner can change an admin's role"
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        valid_roles = [
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.MEMBER,
        ]

        if new_role not in valid_roles:
            return Response(
                {"error": "Role must be ADMIN or MEMBER"},
                status=status.HTTP_400_BAD_REQUEST
            )

        target.role = new_role
        target.save(update_fields=["role"])

        return Response(
            WorkspaceMembershipSerializer(target).data,
            status=status.HTTP_200_OK
        )
        # DELETE: Remove a member.
    elif request.method == "DELETE":

        membership_id = request.data.get("membership_id")

        if not membership_id:
            return Response(
                {"error": "membership_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target = WorkspaceMembership.objects.get(
                pk=membership_id,
                workspace_id=workspace_id
            )

        except (
            WorkspaceMembership.DoesNotExist,
            ValueError,
            TypeError
        ):
            return Response(
                {"error": "Membership not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Never allow anyone to remove the workspace owner.
        if target.role == WorkspaceMembership.Role.OWNER:
            return Response(
                {"error": "The workspace owner cannot be removed"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Only the owner can remove an admin.
        if (
            target.role == WorkspaceMembership.Role.ADMIN
            and current_membership.role != WorkspaceMembership.Role.OWNER
        ):
            return Response(
                {"error": "Only the workspace owner can remove an admin"},
                status=status.HTTP_403_FORBIDDEN
            )

        target.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
    # --------------------------------------------------
# 5. LIST AND CREATE PROJECTS
# GET  /api/projects/
# POST /api/projects/
# --------------------------------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def project_list(request):

    # List projects from workspaces the user belongs to
    if request.method == "GET":

        projects = Project.objects.filter(
            workspace__memberships__user=request.user
        ).select_related(
            "workspace",
            "created_by"
        ).distinct()

        serializer = ProjectSerializer(
            projects,
            many=True
        )

        return Response(serializer.data)

    # Create a project
    elif request.method == "POST":

        workspace_id = request.data.get("workspace")

        # Check that the workspace exists
        try:
            membership = WorkspaceMembership.objects.get(
                workspace_id=workspace_id,
                user=request.user
            )

        except (
            WorkspaceMembership.DoesNotExist,
            ValueError,
            TypeError
        ):
            return Response(
                {
                    "error": "Workspace not found or you do not have access"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Only owners and admins can create projects
        if membership.role not in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN,
        ]:
            return Response(
                {
                    "error": "Only workspace owners and admins can create projects"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ProjectSerializer(
            data=request.data
        )

        if serializer.is_valid():

            project = serializer.save(
                created_by=request.user
            )

            return Response(
                ProjectSerializer(project).data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


# --------------------------------------------------
# 6. RETRIEVE, UPDATE, AND DELETE A PROJECT
# GET    /api/projects/<id>/
# PUT    /api/projects/<id>/
# DELETE /api/projects/<id>/
# --------------------------------------------------

@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def project_detail(request, pk):

    # Only retrieve projects in the user's workspaces
    try:
        project = Project.objects.select_related(
            "workspace",
            "created_by"
        ).get(
            pk=pk,
            workspace__memberships__user=request.user
        )

    except Project.DoesNotExist:
        return Response(
            {
                "error": "Project not found or you do not have access"
            },
            status=status.HTTP_404_NOT_FOUND
        )

    # Retrieve project
    if request.method == "GET":

        serializer = ProjectSerializer(project)

        return Response(serializer.data)

    # Find the user's role in this project's workspace
    try:
        membership = WorkspaceMembership.objects.get(
            workspace=project.workspace,
            user=request.user
        )

    except WorkspaceMembership.DoesNotExist:
        return Response(
            {
                "error": "You do not have access to this workspace"
            },
            status=status.HTTP_404_NOT_FOUND
        )

    # Only owners and admins can modify projects
    if membership.role not in [
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    ]:
        return Response(
            {
                "error": "Only workspace owners and admins can modify projects"
            },
            status=status.HTTP_403_FORBIDDEN
        )

    # Update project
    if request.method == "PUT":

        serializer = ProjectSerializer(
            project,
            data=request.data
        )

        if serializer.is_valid():

            # Do not allow moving projects to another workspace
            # through this endpoint.
            if str(
                serializer.validated_data["workspace"].id
            ) != str(project.workspace_id):
                return Response(
                    {
                        "error": "Projects cannot be moved to another workspace through this endpoint"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer.save()

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # Delete project
    elif request.method == "DELETE":

        if membership.role != WorkspaceMembership.Role.OWNER:
            return Response(
                {
                    "error": "Only the workspace owner can delete projects"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        project.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )
# --------------------------------------------------
# 7. LIST AND CREATE TASKS
# --------------------------------------------------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_list(request):

    # Get tasks belonging to projects in the user's workspaces
    if request.method == "GET":

        tasks = Task.objects.filter(
            project__workspace__memberships__user=request.user
        ).select_related(
            "project",
            "project__workspace",
            "assigned_to",
            "created_by"
        ).distinct()

        serializer = TaskSerializer(
            tasks,
            many=True
        )

        return Response(serializer.data)

    # Create a task
    if request.method == "POST":

        project_id = request.data.get("project")

        # Find the project and confirm workspace membership
        try:
            project = Project.objects.get(
                pk=project_id,
                workspace__memberships__user=request.user
            )

        except (
            Project.DoesNotExist,
            ValueError,
            TypeError
        ):
            return Response(
                {
                    "error": "Project not found or you do not have access"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Check the user's role in the workspace
        membership = WorkspaceMembership.objects.get(
            user=request.user,
            workspace=project.workspace
        )

        # Only owners and admins can create tasks
        if membership.role not in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN,
        ]:
            return Response(
                {
                    "error": "Only workspace owners and admins can create tasks"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = TaskSerializer(
            data=request.data
        )

        if serializer.is_valid():

            # Validate that an assigned user belongs to the same workspace
            assigned_user = serializer.validated_data.get("assigned_to")

            if assigned_user is not None:

                is_member = WorkspaceMembership.objects.filter(
                    user=assigned_user,
                    workspace=project.workspace
                ).exists()

                if not is_member:
                    return Response(
                        {
                            "error": "The assigned user must belong to this workspace"
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            task = serializer.save(
                project=project,
                created_by=request.user
            )

            return Response(
                TaskSerializer(task).data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
# --------------------------------------------------
# 8. RETRIEVE, UPDATE, AND DELETE TASKS
# --------------------------------------------------

@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def task_detail(request, pk):

    # Only retrieve tasks in the user's workspaces
    try:
        task = Task.objects.select_related(
            "project",
            "project__workspace",
            "assigned_to",
            "created_by"
        ).get(
            pk=pk,
            project__workspace__memberships__user=request.user
        )

    except Task.DoesNotExist:
        return Response(
            {
                "error": "Task not found or you do not have access"
            },
            status=status.HTTP_404_NOT_FOUND
        )

    # Retrieve task
    if request.method == "GET":

        serializer = TaskSerializer(task)

        return Response(serializer.data)

    # Find membership in the task's workspace
    membership = WorkspaceMembership.objects.get(
        user=request.user,
        workspace=task.project.workspace
    )

    # Only owners and admins can update or delete tasks for now
    if membership.role not in [
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    ]:
        return Response(
            {
                "error": "Only workspace owners and admins can modify tasks"
            },
            status=status.HTTP_403_FORBIDDEN
        )

    # Delete task
    if request.method == "DELETE":

        task.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    # Update task: PUT replaces fields; PATCH updates selected fields
    partial = request.method == "PATCH"

    serializer = TaskSerializer(
        task,
        data=request.data,
        partial=partial
    )

    if serializer.is_valid():

        # Keep the task in its original project
        new_project = serializer.validated_data.get(
            "project",
            task.project
        )

        if new_project.id != task.project_id:
            return Response(
                {
                    "error": "Moving tasks to another project is not allowed through this endpoint"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate that the assigned user belongs to the same workspace
        assigned_user = serializer.validated_data.get(
            "assigned_to",
            task.assigned_to
        )

        if assigned_user is not None:

            is_member = WorkspaceMembership.objects.filter(
                user=assigned_user,
                workspace=task.project.workspace
            ).exists()

            if not is_member:
                return Response(
                    {
                        "error": "The assigned user must belong to this workspace"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer.save()

        return Response(serializer.data)

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )
# --------------------------------------------------
# 9. USER REGISTRATION
# POST /api/register/
# --------------------------------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")

    # Validate required fields
    if not username or not email or not password:
        return Response(
            {"error": "Username, email, and password are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate username
    if User.objects.filter(username__iexact=username).exists():
        return Response(
            {"error": "This username is already taken"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate email
    if User.objects.filter(email__iexact=email).exists():
        return Response(
            {"error": "This email is already registered"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate password length
    if len(password) < 8:
        return Response(
            {"error": "Password must contain at least 8 characters"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create the user securely using Django's password hashing
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    return Response(
        {
            "message": "Account created successfully",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        },
        status=status.HTTP_201_CREATED
    )


# --------------------------------------------------
# 10. USER LOGIN
# POST /api/login/
# --------------------------------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response(
            {"error": "Username and password are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(
        request,
        username=username,
        password=password
    )

    if user is None:
        return Response(
            {"error": "Invalid username or password"},
            status=status.HTTP_400_BAD_REQUEST
        )

    login(request, user)

    return Response(
        {
            "message": "Login successful",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        },
        status=status.HTTP_200_OK
    )


# --------------------------------------------------
# 11. USER LOGOUT
# POST /api/logout/
# --------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_user(request):
    logout(request)

    return Response(
        {"message": "Logout successful"},
        status=status.HTTP_200_OK
    )
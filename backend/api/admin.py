from django.contrib import admin

from .models import (
    Workspace,
    WorkspaceMembership,
    Project,
    Task,
)


# --------------------------------------------------
# 1. WORKSPACE ADMIN
# --------------------------------------------------

@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "slug",
        "created_at",
    )

    search_fields = (
        "name",
        "slug",
    )


# --------------------------------------------------
# 2. WORKSPACE MEMBERSHIP ADMIN
# --------------------------------------------------

@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "user",
        "workspace",
        "role",
        "created_at",
    )

    list_filter = (
        "role",
    )

    search_fields = (
        "user__username",
        "workspace__name",
    )


# --------------------------------------------------
# 3. PROJECT ADMIN
# --------------------------------------------------

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "workspace",
        "created_by",
        "created_at",
    )

    list_filter = (
        "workspace",
    )

    search_fields = (
        "name",
        "description",
        "workspace__name",
    )


# --------------------------------------------------
# 4. TASK ADMIN
# --------------------------------------------------

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "title",
        "project",
        "status",
        "priority",
        "assigned_to",
        "created_by",
        "created_at",
    )

    list_filter = (
        "status",
        "priority",
        "project",
    )

    search_fields = (
        "title",
        "description",
        "project__name",
    )
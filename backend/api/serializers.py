from rest_framework import serializers

from .models import (
    Workspace,
    WorkspaceMembership,
    Project,
)


class WorkspaceSerializer(serializers.ModelSerializer):

    class Meta:
        model = Workspace

        fields = [
            "id",
            "name",
            "slug",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


class WorkspaceMembershipSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source="user.username",
        read_only=True
    )

    class Meta:
        model = WorkspaceMembership

        fields = [
            "id",
            "user",
            "username",
            "workspace",
            "role",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


class ProjectSerializer(serializers.ModelSerializer):

    workspace_name = serializers.CharField(
        source="workspace.name",
        read_only=True
    )

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True
    )

    class Meta:
        model = Project

        fields = [
            "id",
            "workspace",
            "workspace_name",
            "name",
            "description",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        from rest_framework import serializers

from .models import (
    Workspace,
    WorkspaceMembership,
    Project,
    Task,
)


# --------------------------------------------------
# 1. WORKSPACE SERIALIZER
# --------------------------------------------------

class WorkspaceSerializer(serializers.ModelSerializer):

    class Meta:
        model = Workspace

        fields = [
            "id",
            "name",
            "slug",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


# --------------------------------------------------
# 2. WORKSPACE MEMBERSHIP SERIALIZER
# --------------------------------------------------

class WorkspaceMembershipSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source="user.username",
        read_only=True
    )

    class Meta:
        model = WorkspaceMembership

        fields = [
            "id",
            "user",
            "username",
            "workspace",
            "role",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


# --------------------------------------------------
# 3. PROJECT SERIALIZER
# --------------------------------------------------

class ProjectSerializer(serializers.ModelSerializer):

    workspace_name = serializers.CharField(
        source="workspace.name",
        read_only=True
    )

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True
    )

    class Meta:
        model = Project

        fields = [
            "id",
            "workspace",
            "workspace_name",
            "name",
            "description",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]


# --------------------------------------------------
# 4. TASK SERIALIZER
# --------------------------------------------------

class TaskSerializer(serializers.ModelSerializer):

    project_name = serializers.CharField(
        source="project.name",
        read_only=True
    )

    assigned_to_username = serializers.CharField(
        source="assigned_to.username",
        read_only=True,
        allow_null=True
    )

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True
    )

    class Meta:
        model = Task

        fields = [
            "id",
            "project",
            "project_name",
            "title",
            "description",
            "status",
            "priority",
            "assigned_to",
            "assigned_to_username",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import Workspace, WorkspaceMembership, Project, Task


class TenantIsolationTests(APITestCase):

    def setUp(self):
        # Create users
        self.owner = User.objects.create_user(
            username="owner",
            password="testpass123"
        )

        self.member = User.objects.create_user(
            username="member",
            password="testpass123"
        )

        self.admin = User.objects.create_user(
            username="admin",
            password="testpass123"
        )

        # Create two separate workspaces
        self.workspace1 = Workspace.objects.create(
            name="Tech Solutions",
            slug="tech-solutions"
        )

        self.workspace2 = Workspace.objects.create(
            name="ABC Technologies",
            slug="abc-technologies"
        )

        # Owner belongs to both workspaces
        WorkspaceMembership.objects.create(
            user=self.owner,
            workspace=self.workspace1,
            role=WorkspaceMembership.Role.OWNER
        )

        WorkspaceMembership.objects.create(
            user=self.owner,
            workspace=self.workspace2,
            role=WorkspaceMembership.Role.OWNER
        )

        # Member belongs only to workspace1
        WorkspaceMembership.objects.create(
            user=self.member,
            workspace=self.workspace1,
            role=WorkspaceMembership.Role.MEMBER
        )

        # Admin belongs only to workspace1
        WorkspaceMembership.objects.create(
            user=self.admin,
            workspace=self.workspace1,
            role=WorkspaceMembership.Role.ADMIN
        )

        # Create one project in each workspace
        self.project1 = Project.objects.create(
            workspace=self.workspace1,
            name="Website Redesign",
            description="Redesign the company website",
            created_by=self.owner
        )

        self.project2 = Project.objects.create(
            workspace=self.workspace2,
            name="ABC Website Development",
            description="Develop the ABC website",
            created_by=self.owner
        )

    # ---------------- WORKSPACE TESTS ----------------

    def test_member_can_access_own_workspace(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/workspaces/{self.workspace1.id}/"
        )

        self.assertEqual(response.status_code, 200)

    def test_member_cannot_access_another_workspace(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/workspaces/{self.workspace2.id}/"
        )

        self.assertEqual(response.status_code, 404)

    # ---------------- PROJECT TESTS ----------------

    def test_member_cannot_access_another_workspace_project(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/projects/{self.project2.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_member_cannot_create_project(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            "/api/projects/",
            {
                "workspace": self.workspace1.id,
                "name": "Unauthorized Project",
                "description": "This project should not be created",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_member_cannot_update_project(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.put(
            f"/api/projects/{self.project1.id}/",
            {
                "workspace": self.workspace1.id,
                "name": "Unauthorized Update",
                "description": "This update should not succeed",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_member_cannot_delete_project(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.delete(
            f"/api/projects/{self.project1.id}/"
        )

        self.assertEqual(response.status_code, 403)

        self.assertTrue(
            Project.objects.filter(pk=self.project1.id).exists()
        )

    def test_owner_can_create_project(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/projects/",
            {
                "workspace": self.workspace1.id,
                "name": "Authorized Project",
                "description": "This project should be created",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            Project.objects.filter(
                workspace=self.workspace1,
                name="Authorized Project"
            ).exists()
        )

    def test_member_cannot_update_another_workspace_project(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.put(
            f"/api/projects/{self.project2.id}/",
            {
                "workspace": self.workspace2.id,
                "name": "Unauthorized Cross-Workspace Update",
                "description": "This update should not succeed",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 404)

    def test_owner_cannot_move_project_to_another_workspace(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.put(
            f"/api/projects/{self.project1.id}/",
            {
                "workspace": self.workspace2.id,
                "name": "Moved Project",
                "description": "Attempt to move a project",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 400)

        self.project1.refresh_from_db()

        self.assertEqual(
            self.project1.workspace_id,
            self.workspace1.id
        )

    # ---------------- TASK TESTS ----------------

    def test_member_cannot_create_task(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            "/api/tasks/",
            {
                "project": self.project1.id,
                "title": "Unauthorized task",
                "description": "This task should not be created",
                "status": "TODO",
                "priority": "MEDIUM",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_owner_can_create_task(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            "/api/tasks/",
            {
                "project": self.project2.id,
                "title": "Authorized task",
                "description": "This task should be created",
                "status": "TODO",
                "priority": "HIGH",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 201)

    # ---------------- MEMBERSHIP TESTS ----------------

    def test_owner_can_add_workspace_member(self):
        self.client.force_authenticate(user=self.owner)

        new_user = User.objects.create_user(
            username="newmember",
            password="testpass123"
        )

        response = self.client.post(
            f"/api/workspaces/{self.workspace1.id}/members/",
            {
                "user": new_user.id,
                "role": "MEMBER"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            WorkspaceMembership.objects.filter(
                user=new_user,
                workspace=self.workspace1,
                role=WorkspaceMembership.Role.MEMBER
            ).exists()
        )

    def test_member_cannot_manage_workspace_members(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/workspaces/{self.workspace1.id}/members/"
        )

        self.assertEqual(response.status_code, 403)

    def test_owner_endpoint_rejects_owner_role_assignment(self):
        self.client.force_authenticate(user=self.owner)

        new_user = User.objects.create_user(
            username="anotheruser",
            password="testpass123"
        )

        response = self.client.post(
            f"/api/workspaces/{self.workspace1.id}/members/",
            {
                "user": new_user.id,
                "role": "OWNER"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 400)

        self.assertFalse(
            WorkspaceMembership.objects.filter(
                user=new_user,
                workspace=self.workspace1
            ).exists()
        )

    # ---------------- ADMIN PERMISSION TESTS ----------------

    def test_admin_cannot_delete_project(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(
            f"/api/projects/{self.project1.id}/"
        )

        self.assertEqual(response.status_code, 403)

        self.assertTrue(
            Project.objects.filter(pk=self.project1.id).exists()
        )

    def test_admin_can_create_project(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/projects/",
            {
                "workspace": self.workspace1.id,
                "name": "Admin Created Project",
                "description": "Created by an admin",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            Project.objects.filter(
                workspace=self.workspace1,
                name="Admin Created Project"
            ).exists()
        )

    def test_admin_cannot_assign_owner_role(self):
        self.client.force_authenticate(user=self.admin)

        new_user = User.objects.create_user(
            username="admin_test_user",
            password="testpass123"
        )

        response = self.client.post(
            f"/api/workspaces/{self.workspace1.id}/members/",
            {
                "user": new_user.id,
                "role": "OWNER"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 400)

        self.assertFalse(
            WorkspaceMembership.objects.filter(
                user=new_user,
                workspace=self.workspace1
            ).exists()
        )
    # ADMIN permission tests

    def test_admin_cannot_change_another_admin_role(self):
        # Create another admin in the same workspace.
        another_admin = User.objects.create_user(
            username="another_admin",
            password="testpass123"
        )

        target_membership = WorkspaceMembership.objects.create(
            user=another_admin,
            workspace=self.workspace1,
            role=WorkspaceMembership.Role.ADMIN
        )

        # Authenticate as the existing admin.
        self.client.force_authenticate(user=self.admin)

        # Try to demote the other admin to MEMBER.
        response = self.client.patch(
            f"/api/workspaces/{self.workspace1.id}/members/",
            {
                "membership_id": target_membership.id,
                "role": "MEMBER"
            },
            format="json"
        )

        # The request must be forbidden.
        self.assertEqual(response.status_code, 403)

        # The other admin's role must remain unchanged.
        target_membership.refresh_from_db()

        self.assertEqual(
            target_membership.role,
            WorkspaceMembership.Role.ADMIN
        )

    def test_owner_can_change_admin_role(self):
        # Create another admin in the same workspace.
        another_admin = User.objects.create_user(
            username="admin_to_demote",
            password="testpass123"
        )

        target_membership = WorkspaceMembership.objects.create(
            user=another_admin,
            workspace=self.workspace1,
            role=WorkspaceMembership.Role.ADMIN
        )

        # Authenticate as the workspace owner.
        self.client.force_authenticate(user=self.owner)

        # The owner demotes the admin to MEMBER.
        response = self.client.patch(
            f"/api/workspaces/{self.workspace1.id}/members/",
            {
                "membership_id": target_membership.id,
                "role": "MEMBER"
            },
            format="json"
        )

        # The request should succeed.
        self.assertEqual(response.status_code, 200)

        # Verify the role was changed in the database.
        target_membership.refresh_from_db()

        self.assertEqual(
            target_membership.role,
            WorkspaceMembership.Role.MEMBER
        )
    def test_admin_cannot_remove_another_admin(self):
        # Create another admin in the same workspace.
        another_admin = User.objects.create_user(
            username="admin_to_remove",
            password="testpass123"
        )

        target_membership = WorkspaceMembership.objects.create(
            user=another_admin,
            workspace=self.workspace1,
            role=WorkspaceMembership.Role.ADMIN
        )

        # Authenticate as the existing admin.
        self.client.force_authenticate(user=self.admin)

        # Try to remove the other admin.
        response = self.client.delete(
            f"/api/workspaces/{self.workspace1.id}/members/",
            {
                "membership_id": target_membership.id
            },
            format="json"
        )

        self.assertEqual(response.status_code, 403)

        # Verify the membership still exists.
        self.assertTrue(
            WorkspaceMembership.objects.filter(
                pk=target_membership.id
            ).exists()
        )
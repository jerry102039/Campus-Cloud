import uuid
from types import SimpleNamespace

import pytest

from app.api.deps.auth import (
    get_current_active_superuser,
    get_current_instructor_or_admin,
)
from app.core.permissions import (
    Permission,
    has_permission,
    require_owner_or_permission,
)
from app.exceptions import PermissionDeniedError
from app.models import UserRole


def _user(
    *,
    role: UserRole,
    is_superuser: bool = False,
    user_id: uuid.UUID | None = None,
):
    return SimpleNamespace(
        id=user_id or uuid.uuid4(),
        role=role,
        is_superuser=is_superuser,
    )


def test_admin_role_has_admin_permissions_without_superuser_flag() -> None:
    user = _user(role=UserRole.admin, is_superuser=False)

    assert has_permission(user, Permission.ADMIN_ACCESS) is True
    assert has_permission(user, Permission.USER_MANAGE) is True
    assert has_permission(user, Permission.VM_REQUEST_REVIEW) is True


def test_teacher_only_has_immediate_mode_permission() -> None:
    user = _user(role=UserRole.teacher)

    assert has_permission(user, Permission.VM_REQUEST_USE_IMMEDIATE_MODE) is True
    assert has_permission(user, Permission.ADMIN_ACCESS) is False
    assert has_permission(user, Permission.VM_REQUEST_REVIEW) is False


def test_require_owner_or_permission_allows_owner_and_admin() -> None:
    owner_id = uuid.uuid4()
    owner = _user(role=UserRole.student, user_id=owner_id)
    admin = _user(role=UserRole.admin)

    require_owner_or_permission(owner, owner_id)
    require_owner_or_permission(admin, uuid.uuid4())


def test_require_owner_or_permission_rejects_non_owner_student() -> None:
    user = _user(role=UserRole.student)

    with pytest.raises(PermissionDeniedError):
        require_owner_or_permission(user, uuid.uuid4())


def test_admin_dependency_accepts_admin_role_without_superuser_flag() -> None:
    user = _user(role=UserRole.admin, is_superuser=False)

    assert get_current_active_superuser(user) is user


def test_instructor_dependency_accepts_teacher_and_rejects_student() -> None:
    teacher = _user(role=UserRole.teacher)
    student = _user(role=UserRole.student)

    assert get_current_instructor_or_admin(teacher) is teacher
    with pytest.raises(PermissionDeniedError):
        get_current_instructor_or_admin(student)

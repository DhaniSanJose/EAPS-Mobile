import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Button,
  Typography,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  FormControl,
  Select,
  Card,
  TableCell,
  TextField,
  MenuItem,
  InputLabel,
  Checkbox,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControlLabel,
  Snackbar,
  Alert,
  DialogActions,
  Switch,
  IconButton,
} from "@mui/material";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

const PROTECTED_PAGE_ID = 69;

const UserPageAccess = () => {
  const settings = useContext(SettingsContext);

  // UI Colors
  const [titleColor, setTitleColor] = useState("#000000");
  const [borderColor, setBorderColor] = useState("#000000");

  // Access control
  const pageId = 69;
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  // User list
  const [allUsers, setAllUsers] = useState([]);

  // Selected user access data
  const [selectedUser, setSelectedUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageAccess, setPageAccess] = useState({});
  const [userRole, setUserRole] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [accessDescription, setAccessDescription] = useState("");
  const [createPageAccess, setCreatePageAccess] = useState({});
  const [createPages, setCreatePages] = useState([]);
  const [accessLevels, setAccessLevels] = useState([]);
  const [openEditAccessModal, setOpenEditAccessModal] = useState(false);
  const [editAccessId, setEditAccessId] = useState("");
  const [editAccessDescription, setEditAccessDescription] = useState("");
  const [editPageAccess, setEditPageAccess] = useState({});
  const [editPages, setEditPages] = useState([]);
  const [createAccessSearch, setCreateAccessSearch] = useState("");
  const [editAccessSearch, setEditAccessSearch] = useState("");
  const [accessConfirmDialog, setAccessConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success", // success | error | warning | info
  });

  const auditConfig = {
    headers: {
      "x-employee-id":
        localStorage.getItem("employee_id") ||
        localStorage.getItem("email") ||
        "unknown",
      "x-page-id": pageId,
      "x-audit-actor-id":
        localStorage.getItem("employee_id") ||
        localStorage.getItem("email") ||
        "unknown",
      "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
    },
  };

  const handleCloseSnack = (event, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  // Load settings
  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.border_color) setBorderColor(settings.border_color);
  }, [settings]);

  // Check page privilege
  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedRole !== "registrar") {
      window.location.href = "/login";
      return;
    }

    checkAccess(storedEmployeeID);
    loadAllUsers();
  }, []);

  const checkAccess = async (empID) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/page_access/${empID}/${pageId}`,
      );
      if (res.data && Number(res.data.page_privilege) === 1) {
        setHasAccess(true);
        setCanCreate(Number(res.data?.can_create) === 1);
        setCanEdit(Number(res.data?.can_edit) === 1);
        setCanDelete(Number(res.data?.can_delete) === 1);
      } else {
        setHasAccess(false);
        setCanCreate(false);
        setCanEdit(false);
        setCanDelete(false);
      }
    } catch {
      setHasAccess(false);
      setCanCreate(false);
      setCanEdit(false);
      setCanDelete(false);
    }
  };

  // Load all users
  const loadAllUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/registrars`);
      setAllUsers(res.data);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  // Load selected user's access
  const loadUserAccess = async (user) => {
    setLoading(true);
    setSelectedUser(null);
    setPageAccess({});
    setPages([]);
    setUserRole("");

    try {
      const pagesResp = await axios.get(`${API_BASE_URL}/api/pages`);
      const accessResp = await axios.get(
        `${API_BASE_URL}/api/page_access/${user.employee_id}`,
      );

      const allPages = (pagesResp.data || []).sort((a, b) => a.id - b.id);

      const accessRows = accessResp.data || [];
      const accessMap = buildDefaultPermissionState(allPages);

      accessRows.forEach((row) => {
        const currentPageId = Number(row.page_id);
        accessMap[currentPageId] = {
          access: Number(row.page_privilege) === 1,
          can_create: Number(row.can_create) === 1,
          can_edit: Number(row.can_edit) === 1,
          can_delete: Number(row.can_delete) === 1,
        };
      });

      setPages(allPages);
      setSelectedUser(user); // ✅ full user object
      setPageAccess(accessMap);

      setOpenModal(true);
    } catch {
      setSnack({ open: true, severity: "error", message: "Failed to load access" });
    } finally {
      setLoading(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // change if you want

  const [searchQuery, setSearchQuery] = useState("");

  const buildDefaultPermissionState = (pagesList) => {
    const defaults = {};
    pagesList.forEach((page) => {
      defaults[page.id] = {
        access: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
    });
    return defaults;
  };

  const createEmptyPermission = (access = false) => ({
    access,
    can_create: false,
    can_edit: false,
    can_delete: false,
  });

  const permissionLabels = {
    can_create: "Create",
    can_edit: "Edit",
    can_delete: "Delete",
  };

  const canManageUserPermissions = (permissionKey) => {
    if (canEdit) return true;
    if (permissionKey === "can_create" && canCreate) return true;
    if (permissionKey === "can_delete" && canDelete) return true;
    return false;
  };

  const formatEmployeeName = (user) =>
    user
      ? `${user.last_name}, ${user.first_name} ${user.middle_name || "."}`.trim()
      : "this user";

  const getPageLabel = (targetPageId) => {
    const page = pages.find((p) => Number(p.id) === Number(targetPageId));
    return page?.page_description || `Page ${targetPageId}`;
  };

  const isProtectedPage = (targetPageId) =>
    Number(targetPageId) === PROTECTED_PAGE_ID;

  const closeAccessConfirm = () => {
    setAccessConfirmDialog({
      open: false,
      title: "",
      message: "",
      onConfirm: null,
    });
  };

  const confirmAccessChange = ({ requiresConfirm, title, message, onConfirm }) => {
    if (!requiresConfirm) {
      onConfirm();
      return;
    }

    setAccessConfirmDialog({
      open: true,
      title,
      message,
      onConfirm: () => {
        closeAccessConfirm();
        onConfirm();
      },
    });
  };

  const permissionActionLabels = {
    can_create: "create",
    can_edit: "edit",
    can_delete: "delete",
  };

  const setBulkPermissionState = (pagesList, currentAccess, permissionKey, enabled) => {
    const nextAccess = { ...currentAccess };
    pagesList.forEach((page) => {
      if (!enabled && isProtectedPage(page.id)) return;

      const current = nextAccess[page.id] || createEmptyPermission(false);
      nextAccess[page.id] = {
        ...current,
        access: enabled ? true : current.access,
        [permissionKey]: enabled,
      };
    });
    return nextAccess;
  };

  const getProtectedPageLabel = () => getPageLabel(PROTECTED_PAGE_ID);

  const buildAccessLevelPermissionState = (pagesList) => {
    const defaults = {};
    pagesList.forEach((page) => {
      defaults[page.id] = createEmptyPermission(false);
    });
    return defaults;
  };

  const parseAccessLevelPermissions = (value) => {
    if (!value) return [];

    const normalizeEntry = (entry) => {
      if (typeof entry === "number" || typeof entry === "string") {
        const pageId = Number(entry);
        return Number.isNaN(pageId)
          ? null
          : { page_id: pageId, ...createEmptyPermission(true) };
      }

      if (!entry || typeof entry !== "object") return null;

      const pageId = Number(entry.page_id ?? entry.pageId ?? entry.id);
      if (Number.isNaN(pageId)) return null;

      return {
        page_id: pageId,
        access: Number(entry.page_privilege ?? entry.access ?? 1) === 1,
        can_create: Number(entry.can_create) === 1,
        can_edit: Number(entry.can_edit) === 1,
        can_delete: Number(entry.can_delete) === 1,
      };
    };

    const normalizeList = (list) => list.map(normalizeEntry).filter(Boolean);

    if (Array.isArray(value)) return normalizeList(value);

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return normalizeList(parsed);
      } catch {
        return normalizeList(value.split(",").map((v) => v.trim()));
      }
    }

    return [];
  };

  const buildAccessLevelPayload = (accessState) =>
    Object.entries(accessState)
      .filter(([, permissions]) => permissions?.access)
      .map(([id, permissions]) => ({
        page_id: Number(id),
        page_privilege: 1,
        can_create: permissions.can_create ? 1 : 0,
        can_edit: permissions.can_edit ? 1 : 0,
        can_delete: permissions.can_delete ? 1 : 0,
      }));

  const filterPagesForAccessModal = (pagesList, query) => {
    const words = query.trim().toLowerCase().split(" ").filter(Boolean);
    if (words.length === 0) return pagesList;

    return pagesList.filter((page) => {
      const searchableText = [
        page.id,
        page.page_description,
        page.page_group,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return words.every((word) => searchableText.includes(word));
    });
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    const fullName =
      `${u.first_name} ${u.middle_name || ""} ${u.last_name}`.toLowerCase();

    return (
      u.employee_id.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      fullName.includes(q)
    );
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const filteredCreatePages = filterPagesForAccessModal(
    createPages,
    createAccessSearch,
  );
  const filteredEditPages = filterPagesForAccessModal(
    editPages,
    editAccessSearch,
  );

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Update access privilege
  const executeToggleChange = async (targetPageId, hasAccessNow) => {
    if (!selectedUser) return;
    if (hasAccessNow && !canDelete) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to revoke page access",
      });
      return;
    }
    if (!hasAccessNow && !canCreate) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to grant page access",
      });
      return;
    }

    const newState = !hasAccessNow;
    const previousState = pageAccess[targetPageId] || {
      access: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    };

    setPageAccess((prev) => ({
      ...prev,
      [targetPageId]: {
        ...previousState,
        access: newState,
        can_create: false,
        can_edit: false,
        can_delete: false,
      },
    }));

    try {
      if (newState) {
        await axios.post(
          `${API_BASE_URL}/api/page_access/${selectedUser.employee_id}/${targetPageId}`,
          {},
          auditConfig,
        );
      } else {
        await axios.delete(
          `${API_BASE_URL}/api/page_access/${selectedUser.employee_id}/${targetPageId}`,
          auditConfig,
        );
      }

      setSnack({
        open: true,
        severity: "success",
        message: newState ? "Access granted" : "Access revoked",
      });
    } catch {
      setPageAccess((prev) => ({ ...prev, [targetPageId]: previousState }));
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to update access",
      });
    }
  };

  const requestToggleChange = (targetPageId, hasAccessNow) => {
    if (!selectedUser) return;
    if (hasAccessNow && !canDelete) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to revoke page access",
      });
      return;
    }
    if (!hasAccessNow && !canCreate) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to grant page access",
      });
      return;
    }

    const isRevoke = hasAccessNow;
    const employeeName = formatEmployeeName(selectedUser);
    const pageLabel = getPageLabel(targetPageId);

    confirmAccessChange({
      requiresConfirm: isProtectedPage(targetPageId),
      title: isRevoke ? "Revoke Page Access" : "Modify Page Access",
      message: isRevoke
        ? `Are you sure you want to revoke ${employeeName}'s access to ${pageLabel}?`
        : `Are you sure you want to grant ${employeeName} access to ${pageLabel}?`,
      onConfirm: () => executeToggleChange(targetPageId, hasAccessNow),
    });
  };

  const executePermissionToggle = async (targetPageId, permissionKey) => {
    if (!selectedUser) return;
    if (!canManageUserPermissions(permissionKey)) {
      setSnack({
        open: true,
        severity: "error",
        message: `You do not have permission to manage ${permissionLabels[permissionKey]} access`,
      });
      return;
    }

    const currentState = pageAccess[targetPageId] || {
      access: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    };

    const nextState = {
      ...currentState,
      access: true,
      [permissionKey]: !currentState[permissionKey],
    };

    setPageAccess((prev) => ({
      ...prev,
      [targetPageId]: nextState,
    }));

    try {
      await axios.put(
        `${API_BASE_URL}/api/page_access/${selectedUser.employee_id}/${targetPageId}`,
        {
          page_privilege: nextState.access ? 1 : 0,
          can_create: nextState.can_create ? 1 : 0,
          can_edit: nextState.can_edit ? 1 : 0,
          can_delete: nextState.can_delete ? 1 : 0,
        },
        auditConfig,
      );

      setSnack({
        open: true,
        severity: "success",
        message: "Page permissions updated",
      });
    } catch (err) {
      console.error(err);
      setPageAccess((prev) => ({
        ...prev,
        [targetPageId]: currentState,
      }));
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to update page permissions",
      });
    }
  };

  const requestPermissionToggle = (targetPageId, permissionKey) => {
    if (!selectedUser) return;
    if (!canManageUserPermissions(permissionKey)) {
      setSnack({
        open: true,
        severity: "error",
        message: `You do not have permission to manage ${permissionLabels[permissionKey]} access`,
      });
      return;
    }

    const currentState = pageAccess[targetPageId] || createEmptyPermission(false);
    const isRevoke = Boolean(currentState[permissionKey]);
    const employeeName = formatEmployeeName(selectedUser);
    const pageLabel = getPageLabel(targetPageId);
    const actionLabel = permissionActionLabels[permissionKey];

    confirmAccessChange({
      requiresConfirm: isProtectedPage(targetPageId),
      title: isRevoke ? `Remove ${permissionLabels[permissionKey]} Access` : `Grant ${permissionLabels[permissionKey]} Access`,
      message: isRevoke
        ? `Are you sure you want to remove the capability of ${employeeName} to ${actionLabel} action on ${pageLabel}?`
        : `Are you sure you want to grant ${employeeName} the capability to ${actionLabel} action on ${pageLabel}?`,
      onConfirm: () => executePermissionToggle(targetPageId, permissionKey),
    });
  };

  const openCreateAccessModal = async () => {
    if (!canCreate) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to create access levels",
      });
      return;
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/api/pages`);

      const pagesData = (res.data || []).sort((a, b) => a.id - b.id);

      const defaultAccess = buildAccessLevelPermissionState(pagesData);

      setCreatePages(pagesData);
      setCreatePageAccess(defaultAccess);
      setAccessDescription("");
      setCreateAccessSearch("");
      setOpenCreateModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const openEditAccessLevelModal = async () => {
    if (!canEdit) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to edit access levels",
      });
      return;
    }

    try {
      const [accessRes, pagesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/access_table`),
        axios.get(`${API_BASE_URL}/api/pages`),
      ]);

      const levels = accessRes.data || [];
      const pagesData = (pagesRes.data || []).sort((a, b) => a.id - b.id);

      const defaultAccess = buildAccessLevelPermissionState(pagesData);

      setAccessLevels(levels);
      setEditPages(pagesData);
      setEditPageAccess(defaultAccess);
      setEditAccessId("");
      setEditAccessDescription("");
      setEditAccessSearch("");
      setOpenEditAccessModal(true);
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to load access levels",
      });
    }
  };

  const handleCreateToggle = (pageId) => {
    setCreatePageAccess((prev) => ({
      ...prev,
      [pageId]: prev[pageId]?.access
        ? createEmptyPermission(false)
        : {
          ...(prev[pageId] || createEmptyPermission(false)),
          access: true,
        },
    }));
  };

  const handleCreatePermissionToggle = (pageId, permissionKey) => {
    setCreatePageAccess((prev) => {
      const current = prev[pageId] || createEmptyPermission(false);
      if (!current.access) return prev;

      return {
        ...prev,
        [pageId]: {
          ...current,
          [permissionKey]: !current[permissionKey],
        },
      };
    });
  };

  const handleCreateAssignAll = () => {
    const allAccess = {};
    createPages.forEach((p) => {
      allAccess[p.id] = createEmptyPermission(true);
    });
    setCreatePageAccess(allAccess);
  };

  const handleCreateBulkPermission = async (permissionKey, enabled) => {
    setCreatePageAccess((prev) =>
      setBulkPermissionState(createPages, prev, permissionKey, enabled),
    );

    try {
      await axios.post(
        `${API_BASE_URL}/api/access-level/bulk-permission-audit`,
        {
          modal_context: "create_access",
          permission: permissionKey,
          enabled: enabled ? 1 : 0,
          access_description: accessDescription,
          affected_count: createPages.length,
        },
        auditConfig,
      );
    } catch (err) {
      console.error("Failed to insert create access bulk permission audit:", err);
    }
  };

  const handleSelectAccessLevel = (accessId) => {
    setEditAccessId(accessId);
    const selected = accessLevels.find(
      (level) => Number(level.access_id) === Number(accessId),
    );
    const selectedPages = parseAccessLevelPermissions(selected?.access_page);

    const nextAccess = buildAccessLevelPermissionState(editPages);
    const permissionByPage = selectedPages.reduce((acc, permission) => {
      acc[permission.page_id] = permission;
      return acc;
    }, {});

    editPages.forEach((p) => {
      if (permissionByPage[p.id]) {
        nextAccess[p.id] = {
          access: permissionByPage[p.id].access,
          can_create: permissionByPage[p.id].can_create,
          can_edit: permissionByPage[p.id].can_edit,
          can_delete: permissionByPage[p.id].can_delete,
        };
      }
    });

    setEditAccessDescription(selected?.access_description || "");
    setEditPageAccess(nextAccess);
  };

  const handleEditToggle = (pageId) => {
    setEditPageAccess((prev) => ({
      ...prev,
      [pageId]: prev[pageId]?.access
        ? createEmptyPermission(false)
        : {
          ...(prev[pageId] || createEmptyPermission(false)),
          access: true,
        },
    }));
  };

  const handleEditPermissionToggle = (pageId, permissionKey) => {
    setEditPageAccess((prev) => {
      const current = prev[pageId] || createEmptyPermission(false);
      if (!current.access) return prev;

      return {
        ...prev,
        [pageId]: {
          ...current,
          [permissionKey]: !current[permissionKey],
        },
      };
    });
  };

  const handleEditSelectAll = () => {
    const allAccess = {};
    editPages.forEach((p) => {
      allAccess[p.id] = createEmptyPermission(true);
    });
    setEditPageAccess(allAccess);
  };

  const handleEditClearAll = () => {
    const allAccess = {};
    editPages.forEach((p) => {
      allAccess[p.id] = createEmptyPermission(false);
    });
    setEditPageAccess(allAccess);
  };

  const handleEditBulkPermission = async (permissionKey, enabled) => {
    setEditPageAccess((prev) =>
      setBulkPermissionState(editPages, prev, permissionKey, enabled),
    );

    try {
      await axios.post(
        `${API_BASE_URL}/api/access-level/bulk-permission-audit`,
        {
          modal_context: "edit_access_level",
          permission: permissionKey,
          enabled: enabled ? 1 : 0,
          access_id: editAccessId,
          access_description: editAccessDescription,
          affected_count: editPages.length,
        },
        auditConfig,
      );
    } catch (err) {
      console.error("Failed to insert edit access bulk permission audit:", err);
    }
  };

  const saveEditedAccess = async () => {
    if (!canEdit) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to edit access levels",
      });
      return;
    }

    if (!editAccessId) {
      setSnack({
        open: true,
        severity: "warning",
        message: "Please select an access level",
      });
      return;
    }

    if (!editAccessDescription.trim()) {
      setSnack({
        open: true,
        severity: "warning",
        message: "Description is required",
      });
      return;
    }

    try {
      const selectedPages = buildAccessLevelPayload(editPageAccess);

      await axios.put(`${API_BASE_URL}/api/access/${editAccessId}`, {
        access_description: editAccessDescription,
        access_page: selectedPages,
      }, auditConfig);

      setAccessLevels((prev) =>
        prev.map((level) =>
          Number(level.access_id) === Number(editAccessId)
            ? {
              ...level,
              access_description: editAccessDescription,
              access_page: selectedPages,
            }
            : level,
        ),
      );

      setSnack({
        open: true,
        severity: "success",
        message: "Access level updated successfully",
      });

      setOpenEditAccessModal(false);
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to update access level",
      });
    }
  };

  const saveAccess = async () => {
    if (!canCreate) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to create access levels",
      });
      return;
    }

    try {
      const selectedPages = buildAccessLevelPayload(createPageAccess);

      if (!accessDescription.trim()) {
        setSnack({
          open: true,
          severity: "warning",
          message: "Description is required",
        });
        return;
      }

      await axios.post(`${API_BASE_URL}/api/access`, {
        access_description: accessDescription,
        access_page: selectedPages,
      }, auditConfig);

      setSnack({
        open: true,
        severity: "success",
        message: "Access created successfully",
      });

      setOpenCreateModal(false);
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to create access",
      });
    }
  };

  const grantAllAccess = async () => {
    if (!selectedUser) return;
    if (!canCreate) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to grant page access",
      });
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/page_access/grant-all`, {
        userId: selectedUser.employee_id,
      }, auditConfig);

      const newAccess = {};
      pages.forEach((p) => {
        newAccess[p.id] = {
          access: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
        };
      });

      setPageAccess(newAccess);

      setSnack({
        open: true,
        severity: "success",
        message: "All access granted",
      });
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to grant all access",
      });
    }
  };

  const revokeAllAccess = async () => {
    if (!selectedUser) return;
    if (!canDelete) {
      setSnack({
        open: true,
        severity: "error",
        message: "You do not have permission to revoke page access",
      });
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/page_access/revoke-all`, {
        userId: selectedUser.employee_id,
      }, auditConfig);

      const newAccess = {};
      pages.forEach((p) => {
        if (isProtectedPage(p.id)) {
          newAccess[p.id] = pageAccess[p.id] || createEmptyPermission(false);
          return;
        }

        newAccess[p.id] = createEmptyPermission(false);
      });

      setPageAccess(newAccess);

      setSnack({
        open: true,
        severity: "success",
        message: `All access removed except ${getProtectedPageLabel()}`,
      });
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to remove all access",
      });
    }
  };

  const handleUserBulkPermission = async (permissionKey, enabled) => {
    if (!selectedUser) return;
    if (!canManageUserPermissions(permissionKey)) {
      setSnack({
        open: true,
        severity: "error",
        message: `You do not have permission to manage ${permissionLabels[permissionKey]} access`,
      });
      return;
    }

    const previousAccess = pageAccess;
    const nextAccess = setBulkPermissionState(
      pages,
      pageAccess,
      permissionKey,
      enabled,
    );

    setPageAccess(nextAccess);

    try {
      await axios.put(
        `${API_BASE_URL}/api/page_access/${selectedUser.employee_id}/bulk-permission`,
        {
          permission: permissionKey,
          enabled: enabled ? 1 : 0,
        },
        auditConfig,
      );

      const protectedLabel = getProtectedPageLabel();
      setSnack({
        open: true,
        severity: "success",
        message: enabled
          ? `Granted all ${permissionLabels[permissionKey]} permissions`
          : `Closed all ${permissionLabels[permissionKey]} permissions except ${protectedLabel}`,
      });
    } catch (err) {
      console.error(err);
      setPageAccess(previousAccess);
      setSnack({
        open: true,
        severity: "error",
        message: `Failed to update ${permissionLabels[permissionKey]} permissions`,
      });
    }
  };

  const handleUserStatusToggle = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;

    // Optimistic update
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)),
    );

    try {
      await axios.put(`${API_BASE_URL}/api/update_student_status/${userId}`, {
        status: nextStatus,
      }, auditConfig);

      setSnack({
        open: true,
        severity: "success",
        message: `User status updated to ${nextStatus === 1 ? "Active" : "Inactive"}`,
      });
    } catch (err) {
      console.error(err);
      // Rollback on failure
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, status: currentStatus } : u,
        ),
      );
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to update user status",
      });
    }
  };

  if (hasAccess === null || loading) {
    return <LoadingOverlay open message="Loading..." />;
  }

  if (hasAccess === false) return <Unauthorized />;

  // 🔒 Disable right-click
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // 🔒 Block DevTools shortcuts + Ctrl+P silently
  document.addEventListener("keydown", (e) => {
    const isBlockedKey =
      e.key === "F12" ||
      e.key === "F11" ||
      (e.ctrlKey &&
        e.shiftKey &&
        (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
      (e.ctrlKey && e.key.toLowerCase() === "u") ||
      (e.ctrlKey && e.key.toLowerCase() === "p");

    if (isBlockedKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        paddingRight: 1,
        backgroundColor: "transparent",
        mt: 1,
        padding: 2,
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            color: titleColor,
            fontSize: "36px",
          }}
        >
          USER PAGE ACCESS
        </Typography>

        <TextField
          variant="outlined"
          placeholder="Search Employee ID / Name / Email / Role"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            width: 400,
            backgroundColor: "#fff",
            borderRadius: 1,
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
            },
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} />,
          }}
        />
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />
      <br />

      <TableContainer component={Paper} sx={{ width: "100%" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#6D2323", color: "white" }}>
            <TableRow>
              <TableCell
                colSpan={10}
                sx={{
                  border: `1px solid ${borderColor}`,
                  py: 0.5,
                  backgroundColor: settings?.header_color || "#1976d2",
                  color: "white",
                }}
              >
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  {/* Left: Total Count */}
                  <Typography fontSize="14px" fontWeight="bold" color="white">
                    Total Admin's Records: {filteredUsers.length}
                  </Typography>

                  {/* Right: Pagination Controls */}
                  <Box display="flex" alignItems="center" gap={1}>
                    {/* First & Prev */}
                    <Button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      First
                    </Button>

                    <Button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      Prev
                    </Button>

                    {/* Page Dropdown */}
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        displayEmpty
                        sx={{
                          fontSize: "12px",
                          height: 36,
                          color: "white",
                          border: "1px solid white",
                          backgroundColor: "transparent",
                          ".MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "& svg": {
                            color: "white", // dropdown arrow icon color
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              maxHeight: 200,
                              backgroundColor: "#fff", // dropdown background
                            },
                          },
                        }}
                      >
                        {Array.from({ length: totalPages }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>
                            Page {i + 1}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Typography fontSize="11px" color="white">
                      of {totalPages} page{totalPages > 1 ? "s" : ""}
                    </Typography>

                    {/* Next & Last */}
                    <Button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      Next
                    </Button>

                    <Button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      Last
                    </Button>
                    {canCreate && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={openCreateAccessModal}
                      >
                        Create Access
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="contained"
                        color="info"
                        size="small"
                        onClick={openEditAccessLevelModal}
                      >
                        Edit Access Level
                      </Button>
                    )}
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>
      {/* USER LIST TABLE */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: "#F5F5F5" }}>
              <TableRow>
                <TableCell
                  sx={{
                    color: "black",
                    fontWeight: "bold",
                    border: `1px solid ${borderColor}`,
                    textAlign: "center",
                  }}
                >
                  Employee ID
                </TableCell>
                <TableCell
                  sx={{
                    color: "black",
                    fontWeight: "bold",
                    border: `1px solid ${borderColor}`,
                    textAlign: "center",
                  }}
                >
                  Name
                </TableCell>
                <TableCell
                  sx={{
                    color: "black",
                    fontWeight: "bold",
                    border: `1px solid ${borderColor}`,
                    textAlign: "center",
                  }}
                >
                  Email
                </TableCell>
                <TableCell
                  sx={{
                    color: "black",
                    fontWeight: "bold",
                    border: `1px solid ${borderColor}`,
                    textAlign: "center",
                  }}
                >
                  Role
                </TableCell>
                <TableCell
                  sx={{
                    color: "black",
                    fontWeight: "bold",
                    border: `1px solid ${borderColor}`,
                    textAlign: "center",
                  }}
                >
                  Access Level
                </TableCell>
                <TableCell
                  sx={{
                    color: "black",
                    fontWeight: "bold",
                    border: `1px solid ${borderColor}`,
                    textAlign: "center",
                  }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{
                    color: "black",
                    fontWeight: "bold",
                    border: `1px solid ${borderColor}`,
                    textAlign: "center",
                  }}
                >
                  Action
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedUsers.map((u, i) => (

                <TableRow
                  key={u.id}
                  sx={{
                    backgroundColor: i % 2 === 0 ? "#ffffff" : "lightgray",
                  }}
                >
                  <TableCell
                    sx={{
                      color: "black",
                      border: `1px solid ${borderColor}`,
                      textAlign: "center",
                    }}
                  >
                    {u.employee_id}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "black",
                      border: `1px solid ${borderColor}`,
                      textAlign: "center",
                    }}
                  >{`${u.last_name}, ${u.first_name} ${u.middle_name || "."}`}</TableCell>
                  <TableCell
                    sx={{
                      color: "black",
                      border: `1px solid ${borderColor}`,
                      textAlign: "center",
                    }}
                  >
                    {u.email}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "black",
                      border: `1px solid ${borderColor}`,
                      textAlign: "center",
                    }}
                  >
                    {u.role}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "black",
                      border: `1px solid ${borderColor}`,
                      textAlign: "center",
                    }}
                  >
                    {u.access_description}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "black",
                      textAlign: "center",
                      border: `1px solid ${borderColor}`,
                    }}
                    align="center"
                  >
                    <Switch
                      checked={Number(u.status) === 1}
                      onChange={() =>
                        handleUserStatusToggle(u.id, Number(u.status))
                      }
                      color="primary"
                      size="medium"
                    />
                  </TableCell>

                  <TableCell
                    sx={{
                      color: "black",
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {(canCreate || canEdit || canDelete) && (
                        <Button
                          variant="contained"
                          onClick={() => loadUserAccess(u)}
                          sx={{
                            backgroundColor: "green",
                            color: "white",
                            borderRadius: "5px",
                            padding: "8px 14px",
                            width: "160px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                          }}
                        >
                          <EditIcon fontSize="small" /> Edit Access
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <TableContainer component={Paper} sx={{ width: "100%" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#6D2323", color: "white" }}>
            <TableRow>
              <TableCell
                colSpan={10}
                sx={{
                  border: `1px solid ${borderColor}`,
                  py: 0.5,
                  backgroundColor: settings?.header_color || "#1976d2",
                  color: "white",
                }}
              >
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  {/* Left: Total Count */}
                  <Typography fontSize="14px" fontWeight="bold" color="white">
                    Total Admin's Records: {filteredUsers.length}
                  </Typography>

                  {/* Right: Pagination Controls */}
                  <Box display="flex" alignItems="center" gap={1}>
                    {/* First & Prev */}
                    <Button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      First
                    </Button>

                    <Button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      Prev
                    </Button>

                    {/* Page Dropdown */}
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        displayEmpty
                        sx={{
                          fontSize: "12px",
                          height: 36,
                          color: "white",
                          border: "1px solid white",
                          backgroundColor: "transparent",
                          ".MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "& svg": {
                            color: "white", // dropdown arrow icon color
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              maxHeight: 200,
                              backgroundColor: "#fff", // dropdown background
                            },
                          },
                        }}
                      >
                        {Array.from({ length: totalPages }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>
                            Page {i + 1}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Typography fontSize="11px" color="white">
                      of {totalPages} page{totalPages > 1 ? "s" : ""}
                    </Typography>

                    {/* Next & Last */}
                    <Button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      Next
                    </Button>

                    <Button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      Last
                    </Button>
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      {/* ==================== DIALOG 1: EDIT USER ACCESS ==================== */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: settings?.header_color || "#1976d2",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            🔐 Editing Access For: {selectedUser?.employee_id} |{" "}
            {`${selectedUser?.last_name}, ${selectedUser?.first_name} ${selectedUser?.middle_name || "."}`}
          </Box>
          <IconButton
            onClick={() => setOpenModal(false)}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "50%",
              width: 38,
              height: 38,
              padding: 0,
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.2)",
                border: "2px solid white",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ maxHeight: "70vh" }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} mb={2}>

            {/* Left: Grant All / Remove All */}
            <Box display="flex" gap={1.5}>
              <Button
                variant="contained"
                color="success"
                startIcon={<LockOpenIcon />}
                onClick={grantAllAccess}
                disabled={!canCreate}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
              >
                Grant All Access
              </Button>
              <Button
                variant="contained"
                color="warning"
                startIcon={<LockIcon />}
                onClick={revokeAllAccess}
                disabled={!canDelete}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
              >
                Remove All Access
              </Button>
            </Box>

            {/* Right: Per-permission bulk buttons */}
            <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
              {Object.entries(permissionLabels).map(([permissionKey, label]) => (
                <React.Fragment key={permissionKey}>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    onClick={() => handleUserBulkPermission(permissionKey, true)}
                    disabled={!canManageUserPermissions(permissionKey)}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                  >
                    Grant All {label}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color="error"
                    onClick={() => handleUserBulkPermission(permissionKey, false)}
                    disabled={!canManageUserPermissions(permissionKey)}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                  >
                    Close All {label}
                  </Button>
                </React.Fragment>
              ))}
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Bulk close and remove actions skip {getProtectedPageLabel()} (Page {PROTECTED_PAGE_ID}).
            Change that page using its row switches only.
          </Typography>

          <Paper sx={{ border: `1px solid ${borderColor}` }}>
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                  <TableRow>
                    {["#", "Page Description", "Page Group", "Access", "CREATE", "EDIT", "DELETE"].map((header) => (
                      <TableCell
                        key={header}
                        sx={{
                          color: "white",
                          textAlign: "center",
                          fontWeight: "bold",
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pages.map((p, i) => (
                    <TableRow
                      key={p.id}
                      sx={{ "&:hover": { backgroundColor: "#f5f5f5" }, transition: "background-color 0.2s" }}
                    >
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.id}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                          {Number(p.id) === PROTECTED_PAGE_ID && (
                            <LockIcon fontSize="small" color="warning" titleAccess="Protected page (ID 69)" />
                          )}
                          {p.page_description}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.page_group}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={pageAccess[p.id]?.access || false}
                          onChange={() => requestToggleChange(p.id, pageAccess[p.id]?.access || false)}
                          disabled={
                            pageAccess[p.id]?.access ? !canDelete : !canCreate
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={pageAccess[p.id]?.can_create || false}
                          onChange={() => requestPermissionToggle(p.id, "can_create")}
                          disabled={!canManageUserPermissions("can_create")}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={pageAccess[p.id]?.can_edit || false}
                          onChange={() => requestPermissionToggle(p.id, "can_edit")}
                          disabled={!canManageUserPermissions("can_edit")}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={pageAccess[p.id]?.can_delete || false}
                          onChange={() => requestPermissionToggle(p.id, "can_delete")}
                          disabled={!canManageUserPermissions("can_delete")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="error"
            variant="outlined"

            onClick={() => setOpenModal(false)}

          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>


      {/* ==================== DIALOG 2: CREATE NEW ACCESS ==================== */}
      <Dialog
        open={openCreateModal}
        onClose={() => { setOpenCreateModal(false); setCreateAccessSearch(""); }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: settings?.header_color || "#1976d2",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            ➕ Create New Access
          </Box>
          <IconButton
            onClick={() => { setOpenCreateModal(false); setCreateAccessSearch(""); }}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "50%",
              width: 38,
              height: 38,
              padding: 0,
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.2)",
                border: "2px solid white",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              label="Description"
              fullWidth
              value={accessDescription}
              onChange={(e) => setAccessDescription(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              sx={{ px: 3, fontWeight: 600, textTransform: "none", borderRadius: 2, whiteSpace: "nowrap" }}
              onClick={handleCreateAssignAll}
            >
              Assign All
            </Button>
          </Box>

          <TextField
            fullWidth
            size="small"
            placeholder="Search Page Description / Group / ID"
            value={createAccessSearch}
            onChange={(e) => setCreateAccessSearch(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} /> }}
          />

          <Box display="flex" justifyContent="flex-end" gap={1} mb={2} flexWrap="wrap">
            {Object.entries(permissionLabels).map(([permissionKey, label]) => (
              <React.Fragment key={permissionKey}>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  onClick={() => handleCreateBulkPermission(permissionKey, true)}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                >
                  Grant All {label}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="error"
                  onClick={() => handleCreateBulkPermission(permissionKey, false)}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                >
                  Close All {label}
                </Button>
              </React.Fragment>
            ))}
          </Box>

          <Paper sx={{ border: `1px solid ${borderColor}` }}>
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                  <TableRow>
                    {["#", "Page Description", "Page Group", "Access", "CREATE", "EDIT", "DELETE"].map((header) => (
                      <TableCell
                        key={header}
                        sx={{ color: "white", textAlign: "center", fontWeight: "bold", border: `1px solid ${borderColor}` }}
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCreatePages.map((p, i) => (
                    <TableRow
                      key={p.id}
                      sx={{ "&:hover": { backgroundColor: "#f5f5f5" }, transition: "background-color 0.2s" }}
                    >
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.id}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.page_description}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.page_group}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch checked={createPageAccess[p.id]?.access || false} onChange={() => handleCreateToggle(p.id)} />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={createPageAccess[p.id]?.can_create || false}
                          onChange={() => handleCreatePermissionToggle(p.id, "can_create")}
                          disabled={!createPageAccess[p.id]?.access}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={createPageAccess[p.id]?.can_edit || false}
                          onChange={() => handleCreatePermissionToggle(p.id, "can_edit")}
                          disabled={!createPageAccess[p.id]?.access}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={createPageAccess[p.id]?.can_delete || false}
                          onChange={() => handleCreatePermissionToggle(p.id, "can_delete")}
                          disabled={!createPageAccess[p.id]?.access}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCreatePages.length === 0 && (
                    <TableRow>
                      <TableCell align="center" colSpan={7}>No pages found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="error"
            variant="outlined"

            onClick={() => { setOpenCreateModal(false); setCreateAccessSearch(""); }}

          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveAccess}
            sx={{ px: 4, fontWeight: 600, textTransform: "none", borderRadius: 2 }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>


      {/* ==================== DIALOG 3: EDIT ACCESS LEVEL ==================== */}
      <Dialog
        open={openEditAccessModal}
        onClose={() => { setOpenEditAccessModal(false); setEditAccessSearch(""); }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: settings?.header_color || "#1976d2",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            ✏️ Edit Access Level
          </Box>
          <IconButton
            onClick={() => { setOpenEditAccessModal(false); setEditAccessSearch(""); }}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "50%",
              width: 38,
              height: 38,
              padding: 0,
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.2)",
                border: "2px solid white",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="edit-access-level-select-label">Access Level</InputLabel>
            <Select
              labelId="edit-access-level-select-label"
              value={editAccessId}
              label="Access Level"
              onChange={(e) => handleSelectAccessLevel(e.target.value)}
            >
              <MenuItem value="">Select Access Level</MenuItem>
              {accessLevels.map((access) => (
                <MenuItem key={access.access_id} value={access.access_id}>
                  {access.access_description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Description"
            fullWidth
            value={editAccessDescription}
            onChange={(e) => setEditAccessDescription(e.target.value)}
            sx={{ mb: 2 }}
            disabled={!editAccessId}
          />

          <TextField
            fullWidth
            size="small"
            placeholder="Search Page Description / Group / ID"
            value={editAccessSearch}
            onChange={(e) => setEditAccessSearch(e.target.value)}
            disabled={!editAccessId}
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} /> }}
          />

          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} mb={2}>
            {/* Left: Select All / Clear All */}
            <Box display="flex" gap={1.5}>
              <Button
                variant="contained"
                color="success"
                startIcon={<LockOpenIcon />}
                onClick={handleEditSelectAll}
                disabled={!editAccessId}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
              >
                Select All
              </Button>
              <Button
                variant="contained"
                color="warning"
                startIcon={<LockIcon />}
                onClick={handleEditClearAll}
                disabled={!editAccessId}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
              >
                Clear All
              </Button>
            </Box>

            {/* Right: Per-permission bulk buttons */}
            <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
              {Object.entries(permissionLabels).map(([permissionKey, label]) => (
                <React.Fragment key={permissionKey}>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    onClick={() => handleEditBulkPermission(permissionKey, true)}
                    disabled={!editAccessId}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                  >
                    Grant All {label}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color="error"
                    onClick={() => handleEditBulkPermission(permissionKey, false)}
                    disabled={!editAccessId}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                  >
                    Close All {label}
                  </Button>
                </React.Fragment>
              ))}
            </Box>
          </Box>

          <Paper sx={{ border: `1px solid ${borderColor}` }}>
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                  <TableRow>
                    {["#", "Page Description", "Page Group", "Access", "CREATE", "EDIT", "DELETE"].map((header) => (
                      <TableCell
                        key={header}
                        sx={{ color: "white", textAlign: "center", fontWeight: "bold", border: `1px solid ${borderColor}` }}
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEditPages.map((p, i) => (
                    <TableRow
                      key={p.id}
                      sx={{ "&:hover": { backgroundColor: "#f5f5f5" }, transition: "background-color 0.2s" }}
                    >
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.id}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.page_description}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{p.page_group}</TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={editPageAccess[p.id]?.access || false}
                          onChange={() => handleEditToggle(p.id)}
                          disabled={!editAccessId}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={editPageAccess[p.id]?.can_create || false}
                          onChange={() => handleEditPermissionToggle(p.id, "can_create")}
                          disabled={!editAccessId || !editPageAccess[p.id]?.access}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={editPageAccess[p.id]?.can_edit || false}
                          onChange={() => handleEditPermissionToggle(p.id, "can_edit")}
                          disabled={!editAccessId || !editPageAccess[p.id]?.access}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                        <Switch
                          checked={editPageAccess[p.id]?.can_delete || false}
                          onChange={() => handleEditPermissionToggle(p.id, "can_delete")}
                          disabled={!editAccessId || !editPageAccess[p.id]?.access}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEditPages.length === 0 && (
                    <TableRow>
                      <TableCell align="center" colSpan={7}>No pages found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="error"
            variant="outlined"

            onClick={() => { setOpenEditAccessModal(false); setEditAccessSearch(""); }}

          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveEditedAccess}
            sx={{ px: 4, fontWeight: 600, textTransform: "none", }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={accessConfirmDialog.open}
        onClose={closeAccessConfirm}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" />
          {accessConfirmDialog.title}
        </DialogTitle>
        <DialogContent>
          <Typography>{accessConfirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="error"
            variant="outlined"
            onClick={closeAccessConfirm}>
            Cancel
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => accessConfirmDialog.onConfirm?.()}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={handleCloseSnack}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={handleCloseSnack}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserPageAccess;

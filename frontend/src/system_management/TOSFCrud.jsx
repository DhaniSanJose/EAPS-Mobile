import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  TextField,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid,
  Tabs,
  Tab,
  Chip,
  Stack,
  Divider,
  Card,
  CardContent,
} from "@mui/material";
import EARISTLogo from "../assets/EARISTLogo.png";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import CategoryIcon from "@mui/icons-material/Category";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import SchoolIcon from "@mui/icons-material/School";
import RuleIcon from "@mui/icons-material/Rule";
import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";

// ---------------------------------------------------------------------------
// Small presentational helpers (purely visual — no business logic)
// ---------------------------------------------------------------------------

const StatusChip = ({ active }) => (
  <Chip
    label={active ? "Active" : "Inactive"}
    size="small"
    sx={{
      fontWeight: 600,
      fontSize: "0.7rem",
      color: active ? "#1e7d34" : "#8a8f98",
      backgroundColor: active ? "rgba(46, 160, 67, 0.12)" : "rgba(140, 140, 140, 0.12)",
    }}
  />
);

const SectionHeading = ({ icon, title, subtitle, accentColor, actions }) => (
  <Stack
    direction="row"
    spacing={1.5}
    alignItems={{ xs: "flex-start", sm: "center" }}
    justifyContent="space-between"
    flexWrap="wrap"
    rowGap={1.5}
    sx={{ mb: 2 }}
  >
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: "10px",
          flexShrink: 0,
          backgroundColor: `${accentColor}1a`,
          color: accentColor,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.3 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
    {actions && (
      <Stack direction="row" spacing={1}>
        {actions}
      </Stack>
    )}
  </Stack>
);

const cardSx = (borderColor) => ({
  p: 3,
  mb: 3,
  borderRadius: "14px",
  border: `1px solid ${borderColor}22`,
  boxShadow: "0 1px 3px rgba(16,24,40,0.06)",
});

const fieldLabelSx = { fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.04em", color: "text.secondary", mb: 0.5 };

// Reusable clean table shell — replaces the old "border on every single cell" pattern
const CleanTable = ({ headers, showActionColumn, headerColor, children, emptyMessage, colSpanOverride }) => (
  <TableContainer sx={{ borderRadius: "12px", border: "1px solid #eef0f3", overflow: "hidden" }}>
    <Table size="small">
      <TableHead>
        <TableRow sx={{ backgroundColor: headerColor || "#1976d2" }}>
          {headers.map(
            (header) =>
              (header !== "Actions" || showActionColumn) && (
                <TableCell
                  key={header}
                  sx={{
                    color: "white",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    textAlign: "center",
                    border: "none",
                    py: 1.1,
                  }}
                >
                  {header}
                </TableCell>
              )
          )}
        </TableRow>
      </TableHead>
      <TableBody
        sx={{
          "& tr:nth-of-type(odd)": { backgroundColor: "#fafbfc" },
          "& tr:hover": { backgroundColor: "#f1f5fb" },
          "& td": { border: "none", borderBottom: "1px solid #f0f1f3", textAlign: "center", py: 1 },
        }}
      >
        {React.Children.count(children) === 0 && (
          <TableRow>
            <TableCell colSpan={colSpanOverride || headers.length} sx={{ textAlign: "center", color: "text.secondary", py: 3 }}>
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
        {children}
      </TableBody>
    </Table>
  </TableContainer>
);

const RowActions = ({ canEdit, canDelete, onEdit, onDelete }) => (
  <Stack direction="row" spacing={1} justifyContent="center">
    {canEdit && (
      <Button
        onClick={onEdit}
        size="small"
        startIcon={<EditIcon fontSize="small" />}
        sx={{ textTransform: "none", minWidth: 0, px: 1.4, borderRadius: "8px", backgroundColor: "#e8f5e9", color: "#1e7d34", "&:hover": { backgroundColor: "#d7efd9" } }}
      >
        Edit
      </Button>
    )}
    {canDelete && (
      <Button
        onClick={onDelete}
        size="small"
        startIcon={<DeleteIcon fontSize="small" />}
        sx={{ textTransform: "none", minWidth: 0, px: 1.4, borderRadius: "8px", backgroundColor: "#fdecea", color: "#b3261e", "&:hover": { backgroundColor: "#fbdedb" } }}
      >
        Delete
      </Button>
    )}
  </Stack>
);

// ---------------------------------------------------------------------------

const TOSF = () => {
  const settings = useContext(SettingsContext);

  const feeCategoryOptions = [
    { value: 2, label: "Tuition" },
    { value: 3, label: "Miscellaneous" },
    { value: 5, label: "Other" },
  ];

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");
  const [stepperColor, setStepperColor] = useState("#000000");

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");
  const [branches, setBranches] = useState([
    { id: 1, branch: "Manila" },
    { id: 2, branch: "Cavite" },
  ]);

  useEffect(() => {
    if (!settings) return;

    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);

    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EARISTLogo);
    }

    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
    if (settings.branches) {
      try {
        const parsedBranches =
          typeof settings.branches === "string"
            ? JSON.parse(settings.branches)
            : settings.branches;
        if (Array.isArray(parsedBranches) && parsedBranches.length > 0) {
          setBranches(parsedBranches);
        }
      } catch (error) {
        console.error("Failed to parse branches:", error);
      }
    }
  }, [settings]);

  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const pageId = 99;

  const [employeeID, setEmployeeID] = useState("");
  const permissionHeaders = {
    headers: {
      "x-employee-id": employeeID,
      "x-page-id": pageId,
      "x-audit-actor-id": employeeID,
      "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
    },
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      setUserID(storedID);
      setEmployeeID(storedEmployeeID);

      if (storedRole === "registrar") {
        checkAccess(storedEmployeeID);
      } else {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const checkAccess = async (employeeID) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`);
      if (response.data && response.data.page_privilege === 1) {
        setHasAccess(true);
        setCanCreate(Number(response.data?.can_create) === 1);
        setCanEdit(Number(response.data?.can_edit) === 1);
        setCanDelete(Number(response.data?.can_delete) === 1);
      } else {
        setHasAccess(false);
        setCanCreate(false);
        setCanEdit(false);
        setCanDelete(false);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
      setCanCreate(false);
      setCanEdit(false);
      setCanDelete(false);
      setLoading(false);
    }
  };

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [scholarshipUpdateDialogOpen, setScholarshipUpdateDialogOpen] = useState(false);
  const [scholarshipDeleteDialogOpen, setScholarshipDeleteDialogOpen] = useState(false);
  const [selectedScholarshipId, setSelectedScholarshipId] = useState(null);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [scholarshipForm, setScholarshipForm] = useState({
    scholarship_name: "",
    scholarship_status: 1,
  });
  const [editingScholarshipId, setEditingScholarshipId] = useState(null);
  const [scholarshipRuleOptions, setScholarshipRuleOptions] = useState({
    yearLevels: [],
    schoolYears: [],
    activeSchoolYear: null,
    years: [],
    semesters: [],
  });
  const [selectedScholarshipForRules, setSelectedScholarshipForRules] = useState("");
  const [scholarshipRules, setScholarshipRules] = useState([]);
  const [editingScholarshipRuleId, setEditingScholarshipRuleId] = useState(null);
  const [scholarshipRuleForm, setScholarshipRuleForm] = useState({
    scholarship_id: "",
    fee_rate_id: "",
    discount_type: 0,
    discount_value: "",
    year_level_id: 0,
    school_year_id: "",
    semester_id: "",
    status: 1,
  });
  const [scholarshipRuleUpdateDialogOpen, setScholarshipRuleUpdateDialogOpen] = useState(false);
  const [scholarshipRuleDeleteDialogOpen, setScholarshipRuleDeleteDialogOpen] = useState(false);
  const [selectedScholarshipRuleId, setSelectedScholarshipRuleId] = useState(null);

  const fetchScholarshipTypes = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/scholarship_types`);
      setScholarshipTypes(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching scholarship types:", error);
      showSnackbar("Error fetching scholarship types", "error");
    }
  };

  useEffect(() => {
    fetchScholarshipTypes();
  }, []);

  const fetchScholarshipRuleOptions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tosf/scholarship-fee-options`);
      const schoolYears = Array.isArray(res.data?.schoolYears) ? res.data.schoolYears : [];
      const semesters = Array.isArray(res.data?.semesters) ? res.data.semesters : [];
      const activeSchoolYear = res.data?.activeSchoolYear || null;

      setScholarshipRuleOptions({
        yearLevels: Array.isArray(res.data?.yearLevels) ? res.data.yearLevels : [],
        schoolYears,
        activeSchoolYear,
        years: Array.isArray(res.data?.years) ? res.data.years : [],
        semesters,
      });
      setScholarshipRuleForm((prev) => ({
        ...prev,
        school_year_id: prev.school_year_id || (activeSchoolYear?.year_id == null ? "" : String(activeSchoolYear.year_id)),
        semester_id: prev.semester_id || (activeSchoolYear?.semester_id == null ? "" : String(activeSchoolYear.semester_id)),
      }));
    } catch (error) {
      console.error("Error fetching scholarship fee options:", error);
      showSnackbar("Error fetching scholarship fee options", "error");
    }
  };

  useEffect(() => {
    fetchScholarshipRuleOptions();
  }, []);

  const fetchScholarshipRules = async (scholarshipId) => {
    if (!scholarshipId) {
      setScholarshipRules([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tosf/scholarship-fees`, {
        params: { scholarship_id: scholarshipId },
      });
      setScholarshipRules(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching scholarship fees:", error);
      showSnackbar("Error fetching scholarship fees", "error");
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const defaultFeeCatalogForm = {
    fee_code: "",
    fee_name: "",
    fee_category: 5,
    is_active: 1,
    sort_order: 0,
    fee_group: "",
    account_type: "",
  };

  const defaultFeeRateForm = {
    fee_id: "",
    dprtmnt_curriculum_id: "",
    branch_id: "",
    amount: "",
    applied_to: 0,
    applies_to_all: 1,
    is_active: 1,
  };

  const [feeCatalog, setFeeCatalog] = useState([]);
  const [feeRates, setFeeRates] = useState([]);
  const [curriculumOptions, setCurriculumOptions] = useState([]);
  const [yearLevelOptions, setYearLevelOptions] = useState([]);
  const [feeCatalogForm, setFeeCatalogForm] = useState(defaultFeeCatalogForm);
  const [feeRateForm, setFeeRateForm] = useState(defaultFeeRateForm);
  const [feeCatalogDeleteDialogOpen, setFeeCatalogDeleteDialogOpen] = useState(false);
  const [feeRateDeleteDialogOpen, setFeeRateDeleteDialogOpen] = useState(false);
  const [selectedFeeCatalog, setSelectedFeeCatalog] = useState(null);
  const [selectedFeeRate, setSelectedFeeRate] = useState(null);
  const [feeCatalogEditDialogOpen, setFeeCatalogEditDialogOpen] = useState(false);
  const [feeCatalogEditForm, setFeeCatalogEditForm] = useState(defaultFeeCatalogForm);
  const [feeCatalogEditId, setFeeCatalogEditId] = useState(null);
  const [feeRateEditDialogOpen, setFeeRateEditDialogOpen] = useState(false);
  const [feeRateEditForm, setFeeRateEditForm] = useState(defaultFeeRateForm);
  const [feeRateEditId, setFeeRateEditId] = useState(null);

  const defaultFeeGroupForm = { description: "" };
  const defaultAccountTypeForm = { description: "" };

  const [feeGroups, setFeeGroups] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [feeGroupForm, setFeeGroupForm] = useState(defaultFeeGroupForm);
  const [accountTypeForm, setAccountTypeForm] = useState(defaultAccountTypeForm);
  const [feeGroupDeleteDialogOpen, setFeeGroupDeleteDialogOpen] = useState(false);
  const [accountTypeDeleteDialogOpen, setAccountTypeDeleteDialogOpen] = useState(false);
  const [selectedFeeGroup, setSelectedFeeGroup] = useState(null);
  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [feeGroupEditDialogOpen, setFeeGroupEditDialogOpen] = useState(false);
  const [feeGroupEditForm, setFeeGroupEditForm] = useState(defaultFeeGroupForm);
  const [feeGroupEditId, setFeeGroupEditId] = useState(null);
  const [accountTypeEditDialogOpen, setAccountTypeEditDialogOpen] = useState(false);
  const [accountTypeEditForm, setAccountTypeEditForm] = useState(defaultAccountTypeForm);
  const [accountTypeEditId, setAccountTypeEditId] = useState(null);

  const fetchDynamicFees = async () => {
    try {
      const [catalogRes, ratesRes, optionsRes, feeGroupsRes, accountTypesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tosf/fee-catalog`),
        axios.get(`${API_BASE_URL}/api/tosf/fee-rates`),
        axios.get(`${API_BASE_URL}/api/tosf/fee-options`),
        axios.get(`${API_BASE_URL}/api/tosf/fee-groups`),
        axios.get(`${API_BASE_URL}/api/tosf/account-types`),
      ]);

      setFeeCatalog(Array.isArray(catalogRes.data) ? catalogRes.data : []);
      setFeeRates(Array.isArray(ratesRes.data) ? ratesRes.data : []);
      setFeeGroups(Array.isArray(feeGroupsRes.data) ? feeGroupsRes.data : []);
      setAccountTypes(Array.isArray(accountTypesRes.data) ? accountTypesRes.data : []);
      const nextYearLevels = Array.isArray(optionsRes.data?.yearLevels)
        ? optionsRes.data.yearLevels
        : [];
      setCurriculumOptions(Array.isArray(optionsRes.data?.curricula) ? optionsRes.data.curricula : []);
      setYearLevelOptions(nextYearLevels);
      setFeeRateForm((prev) => {
        if (!nextYearLevels.length) return prev;
        const exists = nextYearLevels.some(
          (level) => String(level.year_level_id) === String(prev.applied_to)
        );
        return exists || Number(prev.applied_to) === 0 ? prev : { ...prev, applied_to: 0 };
      });
    } catch (err) {
      console.error("Error fetching dynamic fees:", err);
      showSnackbar("Failed to fetch dynamic fees", "error");
    }
  };

  useEffect(() => {
    fetchDynamicFees();
  }, []);

  const handleFeeCatalogChange = (e) => {
    const { name, value } = e.target;
    setFeeCatalogForm((prev) => ({
      ...prev,
      [name]: ["fee_category", "is_active", "sort_order", "fee_group", "account_type"].includes(name)
        ? value === "" ? "" : Number(value)
        : value,
    }));
  };

  const handleFeeCatalogEditChange = (e) => {
    const { name, value } = e.target;
    setFeeCatalogEditForm((prev) => ({
      ...prev,
      [name]: ["fee_category", "is_active", "sort_order", "fee_group", "account_type"].includes(name)
        ? value === "" ? "" : Number(value)
        : value,
    }));
  };

  const handleFeeRateChange = (e) => {
    const { name, value } = e.target;
    setFeeRateForm((prev) => ({
      ...prev,
      [name]: ["fee_id", "applied_to", "applies_to_all", "is_active"].includes(name)
        ? Number(value)
        : name === "amount"
          ? value.replace(/\D/g, "")
        : value,
      ...(name === "applies_to_all" && Number(value) === 1
        ? { dprtmnt_curriculum_id: "" }
        : {}),
    }));
  };

  const handleFeeRateEditChange = (e) => {
    const { name, value } = e.target;
    setFeeRateEditForm((prev) => ({
      ...prev,
      [name]: ["fee_id", "applied_to", "applies_to_all", "is_active"].includes(name)
        ? Number(value)
        : name === "amount"
          ? value.replace(/\D/g, "")
        : value,
      ...(name === "applies_to_all" && Number(value) === 1
        ? { dprtmnt_curriculum_id: "" }
        : {}),
    }));
  };

  const normalizeFeeRateParams = (form) => {
    const appliesToAll = Number(form.applies_to_all ?? 1) === 1 ? 1 : 0;
    const appliedTo =
      form.applied_to === "" || form.applied_to == null ? 0 : Number(form.applied_to);
    const branchId =
      form.branch_id === "" || form.branch_id == null ? null : Number(form.branch_id);
    const dprtmntCurriculumId =
      appliesToAll === 1
        ? null
        : form.dprtmnt_curriculum_id === "" || form.dprtmnt_curriculum_id == null
          ? null
          : Number(form.dprtmnt_curriculum_id);
    const feeId =
      form.fee_id === "" || form.fee_id == null ? null : Number(form.fee_id);

    return { feeId, dprtmntCurriculumId, branchId, appliedTo, appliesToAll };
  };

  const feeRateParamsMatch = (left, right) =>
    left.feeId === right.feeId &&
    left.dprtmntCurriculumId === right.dprtmntCurriculumId &&
    left.branchId === right.branchId &&
    left.appliedTo === right.appliedTo &&
    left.appliesToAll === right.appliesToAll;

  const findDuplicateFeeRate = (form, excludeFeeRateId = null) => {
    const candidate = normalizeFeeRateParams(form);
    if (!candidate.feeId) return null;

    return (
      feeRates.find((rate) => {
        if (excludeFeeRateId && String(rate.fee_rate_id) === String(excludeFeeRateId)) {
          return false;
        }

        return feeRateParamsMatch(candidate, {
          feeId: rate.fee_id == null ? null : Number(rate.fee_id),
          dprtmntCurriculumId:
            Number(rate.applies_to_all ?? 1) === 1
              ? null
              : rate.dprtmnt_curriculum_id == null || rate.dprtmnt_curriculum_id === ""
                ? null
                : Number(rate.dprtmnt_curriculum_id),
          branchId:
            rate.branch_id == null || rate.branch_id === ""
              ? null
              : Number(rate.branch_id),
          appliedTo: rate.applied_to == null ? 0 : Number(rate.applied_to),
          appliesToAll: Number(rate.applies_to_all ?? 1) === 1 ? 1 : 0,
        });
      }) || null
    );
  };

  const getFeeRateDuplicateMessage = (duplicate) => {
    const feeLabel = duplicate.fee_code
      ? `${duplicate.fee_code} - ${duplicate.fee_name}`
      : duplicate.fee_name || "this fee";

    return `A fee rate for ${feeLabel} with the same curriculum scope, branch, and year level already exists.`;
  };

  const findFeeWithSortOrder = (sortOrder, excludeFeeId = null) =>
    feeCatalog.find(
      (fee) =>
        Number(fee.sort_order) === Number(sortOrder) &&
        String(fee.fee_id) !== String(excludeFeeId)
    );

  const getSortOrderConflictMessage = (sortOrder, excludeFeeId = null) => {
    const duplicate = findFeeWithSortOrder(sortOrder, excludeFeeId);
    if (!duplicate) return null;

    const feeLabel = duplicate.fee_code
      ? `${duplicate.fee_code} - ${duplicate.fee_name}`
      : duplicate.fee_name || "another fee";

    return `Display order ${sortOrder} is already assigned to ${feeLabel}. Please choose a different order number.`;
  };

  const resetFeeCatalogForm = () => {
    setFeeCatalogForm(defaultFeeCatalogForm);
  };

  const closeFeeCatalogEditDialog = () => {
    setFeeCatalogEditDialogOpen(false);
    setFeeCatalogEditId(null);
    setFeeCatalogEditForm(defaultFeeCatalogForm);
  };

  const resetFeeRateForm = () => {
    setFeeRateForm(defaultFeeRateForm);
  };

  const closeFeeRateEditDialog = () => {
    setFeeRateEditDialogOpen(false);
    setFeeRateEditId(null);
    setFeeRateEditForm(defaultFeeRateForm);
  };

  const createFeeCatalog = async () => {
    if (!canCreate) {
      showSnackbar("You do not have permission to create items on this page", "error");
      return;
    }

    const sortOrderConflict = getSortOrderConflictMessage(feeCatalogForm.sort_order);
    if (sortOrderConflict) {
      showSnackbar(sortOrderConflict, "warning");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/tosf/fee-catalog`, feeCatalogForm, permissionHeaders);
      showSnackbar("Fee added successfully!");
      resetFeeCatalogForm();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error saving fee:", error);
      showSnackbar(error.response?.data?.message || "Error saving fee", "error");
    }
  };

  const updateFeeCatalog = async () => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    const sortOrderConflict = getSortOrderConflictMessage(
      feeCatalogEditForm.sort_order,
      feeCatalogEditId
    );
    if (sortOrderConflict) {
      showSnackbar(sortOrderConflict, "warning");
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/tosf/fee-catalog/${feeCatalogEditId}`,
        feeCatalogEditForm,
        permissionHeaders
      );
      showSnackbar("Fee updated successfully!");
      closeFeeCatalogEditDialog();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error updating fee:", error);
      showSnackbar(error.response?.data?.message || "Error updating fee", "error");
    }
  };

  const handleFeeCatalogSubmit = async (e) => {
    e.preventDefault();
    await createFeeCatalog();
  };

  const handleFeeCatalogEditSubmit = async (e) => {
    e.preventDefault();
    await updateFeeCatalog();
  };

  const handleFeeCatalogEdit = (fee) => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    setFeeCatalogEditForm({
      fee_code: fee.fee_code || "",
      fee_name: fee.fee_name || "",
      fee_category: [2, 3, 5].includes(Number(fee.fee_category))
        ? Number(fee.fee_category)
        : 5,
      is_active: Number(fee.is_active ?? 1),
      sort_order: Number(fee.sort_order ?? 0),
      fee_group: fee.fee_group ?? "",
      account_type: fee.account_type ?? "",
    });
    setFeeCatalogEditId(fee.fee_id);
    setFeeCatalogEditDialogOpen(true);
  };

  const handleFeeCatalogDelete = (fee) => {
    if (!canDelete) {
      showSnackbar("You do not have permission to delete this item", "error");
      return;
    }
    setSelectedFeeCatalog(fee);
    setFeeCatalogDeleteDialogOpen(true);
  };

  const executeFeeCatalogDelete = async () => {
    if (!selectedFeeCatalog) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/tosf/fee-catalog/${selectedFeeCatalog.fee_id}`, permissionHeaders);
      showSnackbar("Fee deleted successfully!");
      fetchDynamicFees();
    } catch (error) {
      console.error("Error deleting fee:", error);
      showSnackbar(error.response?.data?.message || "Error deleting fee", "error");
    } finally {
      setFeeCatalogDeleteDialogOpen(false);
      setSelectedFeeCatalog(null);
    }
  };

  const handleFeeGroupChange = (e) => {
    const { name, value } = e.target;
    setFeeGroupForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFeeGroupEditChange = (e) => {
    const { name, value } = e.target;
    setFeeGroupEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountTypeChange = (e) => {
    const { name, value } = e.target;
    setAccountTypeForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountTypeEditChange = (e) => {
    const { name, value } = e.target;
    setAccountTypeEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetFeeGroupForm = () => {
    setFeeGroupForm(defaultFeeGroupForm);
  };

  const closeFeeGroupEditDialog = () => {
    setFeeGroupEditDialogOpen(false);
    setFeeGroupEditId(null);
    setFeeGroupEditForm(defaultFeeGroupForm);
  };

  const resetAccountTypeForm = () => {
    setAccountTypeForm(defaultAccountTypeForm);
  };

  const closeAccountTypeEditDialog = () => {
    setAccountTypeEditDialogOpen(false);
    setAccountTypeEditId(null);
    setAccountTypeEditForm(defaultAccountTypeForm);
  };

  const createFeeGroup = async () => {
    if (!canCreate) {
      showSnackbar("You do not have permission to create items on this page", "error");
      return;
    }

    if (!feeGroupForm.description.trim()) {
      showSnackbar("Fee group description is required", "warning");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/tosf/fee-groups`, feeGroupForm, permissionHeaders);
      showSnackbar("Fee group added successfully!");
      resetFeeGroupForm();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error saving fee group:", error);
      showSnackbar(error.response?.data?.message || "Error saving fee group", "error");
    }
  };

  const updateFeeGroup = async () => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    if (!feeGroupEditForm.description.trim()) {
      showSnackbar("Fee group description is required", "warning");
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/tosf/fee-groups/${feeGroupEditId}`,
        feeGroupEditForm,
        permissionHeaders
      );
      showSnackbar("Fee group updated successfully!");
      closeFeeGroupEditDialog();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error updating fee group:", error);
      showSnackbar(error.response?.data?.message || "Error updating fee group", "error");
    }
  };

  const handleFeeGroupSubmit = async (e) => {
    e.preventDefault();
    await createFeeGroup();
  };

  const handleFeeGroupEditSubmit = async (e) => {
    e.preventDefault();
    await updateFeeGroup();
  };

  const handleFeeGroupEdit = (item) => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    setFeeGroupEditForm({ description: item.description || "" });
    setFeeGroupEditId(item.id);
    setFeeGroupEditDialogOpen(true);
  };

  const handleFeeGroupDelete = (item) => {
    if (!canDelete) {
      showSnackbar("You do not have permission to delete this item", "error");
      return;
    }
    setSelectedFeeGroup(item);
    setFeeGroupDeleteDialogOpen(true);
  };

  const executeFeeGroupDelete = async () => {
    if (!selectedFeeGroup) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/tosf/fee-groups/${selectedFeeGroup.id}`, permissionHeaders);
      showSnackbar("Fee group deleted successfully!");
      fetchDynamicFees();
    } catch (error) {
      console.error("Error deleting fee group:", error);
      showSnackbar(error.response?.data?.message || "Error deleting fee group", "error");
    } finally {
      setFeeGroupDeleteDialogOpen(false);
      setSelectedFeeGroup(null);
    }
  };

  const createAccountType = async () => {
    if (!canCreate) {
      showSnackbar("You do not have permission to create items on this page", "error");
      return;
    }

    if (!accountTypeForm.description.trim()) {
      showSnackbar("Account type description is required", "warning");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/tosf/account-types`, accountTypeForm, permissionHeaders);
      showSnackbar("Account type added successfully!");
      resetAccountTypeForm();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error saving account type:", error);
      showSnackbar(error.response?.data?.message || "Error saving account type", "error");
    }
  };

  const updateAccountType = async () => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    if (!accountTypeEditForm.description.trim()) {
      showSnackbar("Account type description is required", "warning");
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/tosf/account-types/${accountTypeEditId}`,
        accountTypeEditForm,
        permissionHeaders
      );
      showSnackbar("Account type updated successfully!");
      closeAccountTypeEditDialog();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error updating account type:", error);
      showSnackbar(error.response?.data?.message || "Error updating account type", "error");
    }
  };

  const handleAccountTypeSubmit = async (e) => {
    e.preventDefault();
    await createAccountType();
  };

  const handleAccountTypeEditSubmit = async (e) => {
    e.preventDefault();
    await updateAccountType();
  };

  const handleAccountTypeEdit = (item) => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    setAccountTypeEditForm({ description: item.description || "" });
    setAccountTypeEditId(item.id);
    setAccountTypeEditDialogOpen(true);
  };

  const handleAccountTypeDelete = (item) => {
    if (!canDelete) {
      showSnackbar("You do not have permission to delete this item", "error");
      return;
    }
    setSelectedAccountType(item);
    setAccountTypeDeleteDialogOpen(true);
  };

  const executeAccountTypeDelete = async () => {
    if (!selectedAccountType) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/tosf/account-types/${selectedAccountType.id}`, permissionHeaders);
      showSnackbar("Account type deleted successfully!");
      fetchDynamicFees();
    } catch (error) {
      console.error("Error deleting account type:", error);
      showSnackbar(error.response?.data?.message || "Error deleting account type", "error");
    } finally {
      setAccountTypeDeleteDialogOpen(false);
      setSelectedAccountType(null);
    }
  };

  const createFeeRate = async () => {
    if (!canCreate) {
      showSnackbar("You do not have permission to create items on this page", "error");
      return;
    }

    const duplicate = findDuplicateFeeRate(feeRateForm);
    if (duplicate) {
      showSnackbar(getFeeRateDuplicateMessage(duplicate), "error");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/tosf/fee-rates`, feeRateForm, permissionHeaders);
      showSnackbar("Fee rate added successfully!");
      resetFeeRateForm();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error saving fee rate:", error);
      showSnackbar(error.response?.data?.message || "Error saving fee rate", "error");
    }
  };

  const updateFeeRate = async () => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    const duplicate = findDuplicateFeeRate(feeRateEditForm, feeRateEditId);
    if (duplicate) {
      showSnackbar(getFeeRateDuplicateMessage(duplicate), "error");
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/tosf/fee-rates/${feeRateEditId}`,
        feeRateEditForm,
        permissionHeaders
      );
      showSnackbar("Fee rate updated successfully!");
      closeFeeRateEditDialog();
      fetchDynamicFees();
    } catch (error) {
      console.error("Error updating fee rate:", error);
      showSnackbar(error.response?.data?.message || "Error updating fee rate", "error");
    }
  };

  const handleFeeRateSubmit = async (e) => {
    e.preventDefault();
    await createFeeRate();
  };

  const handleFeeRateEditSubmit = async (e) => {
    e.preventDefault();
    await updateFeeRate();
  };

  const handleFeeRateEdit = (rate) => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    setFeeRateEditForm({
      fee_id: Number(rate.fee_id || ""),
      dprtmnt_curriculum_id: rate.dprtmnt_curriculum_id || "",
      branch_id: rate.branch_id || "",
      amount: rate.amount || "",
      applied_to: Number(rate.applied_to) === 0 || yearLevelOptions.some(
        (level) => String(level.year_level_id) === String(rate.applied_to)
      )
        ? Number(rate.applied_to)
        : 0,
      applies_to_all: Number(rate.applies_to_all ?? 1),
      is_active: Number(rate.is_active ?? 1),
    });
    setFeeRateEditId(rate.fee_rate_id);
    setFeeRateEditDialogOpen(true);
  };

  const handleFeeRateDelete = (rate) => {
    if (!canDelete) {
      showSnackbar("You do not have permission to delete this item", "error");
      return;
    }
    setSelectedFeeRate(rate);
    setFeeRateDeleteDialogOpen(true);
  };

  const executeFeeRateDelete = async () => {
    if (!selectedFeeRate) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/tosf/fee-rates/${selectedFeeRate.fee_rate_id}`, permissionHeaders);
      showSnackbar("Fee rate deleted successfully!");
      fetchDynamicFees();
    } catch (error) {
      console.error("Error deleting fee rate:", error);
      showSnackbar(error.response?.data?.message || "Error deleting fee rate", "error");
    } finally {
      setFeeRateDeleteDialogOpen(false);
      setSelectedFeeRate(null);
    }
  };

  const handleScholarshipChange = (e) => {
    const { name, value } = e.target;

    if (name === "scholarship_status") {
      setScholarshipForm((prev) => ({
        ...prev,
        scholarship_status: Number(value),
      }));
      return;
    }

    setScholarshipForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetScholarshipForm = () => {
    setScholarshipForm({
      scholarship_name: "",
      scholarship_status: 1,
    });
    setEditingScholarshipId(null);
  };

  const saveScholarshipType = async () => {
    if (editingScholarshipId && !canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }

    if (!editingScholarshipId && !canCreate) {
      showSnackbar("You do not have permission to create items on this page", "error");
      return;
    }

    try {
      if (editingScholarshipId) {
        await axios.put(
          `${API_BASE_URL}/api/update_scholarship_type/${editingScholarshipId}`,
          scholarshipForm,
          permissionHeaders,
        );
        showSnackbar("Scholarship type updated successfully!");
      } else {
        await axios.post(`${API_BASE_URL}/api/insert_scholarship_type`, scholarshipForm, permissionHeaders);
        showSnackbar("Scholarship type added successfully!");
      }

      resetScholarshipForm();
      fetchScholarshipTypes();
    } catch (error) {
      console.error("Error saving scholarship type:", error);
      showSnackbar("Error saving scholarship type", "error");
    }
  };

  const handleScholarshipSubmit = async (e) => {
    e.preventDefault();
    if (editingScholarshipId) {
      setScholarshipUpdateDialogOpen(true);
      return;
    }
    await saveScholarshipType();
  };

  const handleScholarshipEdit = (item) => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }
    setScholarshipForm({
      scholarship_name: item.scholarship_name || "",
      scholarship_status: Number(item.scholarship_status ?? 1),
    });
    setEditingScholarshipId(item.id);
  };

  const resetScholarshipRuleForm = () => {
    const activeSchoolYear = scholarshipRuleOptions.activeSchoolYear;

    setScholarshipRuleForm({
      scholarship_id: selectedScholarshipForRules || "",
      fee_rate_id: "",
      discount_type: 0,
      discount_value: "",
      year_level_id: 0,
      school_year_id: activeSchoolYear?.year_id == null ? "" : String(activeSchoolYear.year_id),
      semester_id: activeSchoolYear?.semester_id == null ? "" : String(activeSchoolYear.semester_id),
      status: 1,
    });
    setEditingScholarshipRuleId(null);
  };

  const handleScholarshipRuleChange = (e) => {
    const { name, value } = e.target;
    if (name === "discount_type") {
      const nextDiscountType = Number(value);
      setScholarshipRuleForm((prev) => ({
        ...prev,
        discount_type: nextDiscountType,
        discount_value: nextDiscountType === 0 ? "" : prev.discount_value,
      }));
      return;
    }
    if (["year_level_id", "status"].includes(name)) {
      setScholarshipRuleForm((prev) => ({ ...prev, [name]: Number(value) }));
      return;
    }
    setScholarshipRuleForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveScholarshipRule = async () => {
    if (editingScholarshipRuleId && !canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }
    if (!editingScholarshipRuleId && !canCreate) {
      showSnackbar("You do not have permission to create items on this page", "error");
      return;
    }

    try {
      const payload = {
        scholarship_id: Number(scholarshipRuleForm.scholarship_id || selectedScholarshipForRules),
        fee_rate_id: Number(scholarshipRuleForm.fee_rate_id),
        discount_type: Number(scholarshipRuleForm.discount_type),
        discount_value: Number(scholarshipRuleForm.discount_type) === 0 || scholarshipRuleForm.discount_value === ""
          ? null
          : Number(scholarshipRuleForm.discount_value),
        year_level_id: Number(scholarshipRuleForm.year_level_id || 0),
        school_year_id: Number(scholarshipRuleForm.school_year_id),
        semester_id: Number(scholarshipRuleForm.semester_id),
        status: Number(scholarshipRuleForm.status),
      };

      if (editingScholarshipRuleId) {
        await axios.put(
          `${API_BASE_URL}/api/tosf/scholarship-fees/${editingScholarshipRuleId}`,
          payload,
          permissionHeaders,
        );
        showSnackbar("Scholarship fee updated successfully!");
      } else {
        await axios.post(
          `${API_BASE_URL}/api/tosf/scholarship-fees`,
          payload,
          permissionHeaders,
        );
        showSnackbar("Scholarship fee added successfully!");
      }

      resetScholarshipRuleForm();
      fetchScholarshipRules(selectedScholarshipForRules);
    } catch (error) {
      console.error("Error saving scholarship fee:", error);
      showSnackbar(error.response?.data?.message || "Error saving scholarship fee", "error");
    }
  };

  const handleScholarshipRuleSubmit = async (e) => {
    e.preventDefault();
    if (editingScholarshipRuleId) {
      setScholarshipRuleUpdateDialogOpen(true);
      return;
    }
    await saveScholarshipRule();
  };

  const handleScholarshipRuleEdit = (rule) => {
    if (!canEdit) {
      showSnackbar("You do not have permission to edit this item", "error");
      return;
    }
    setEditingScholarshipRuleId(rule.id);
    setScholarshipRuleForm({
      scholarship_id: String(rule.scholarship_id ?? selectedScholarshipForRules ?? ""),
      fee_rate_id: String(rule.fee_rate_id ?? ""),
      discount_type: Number(rule.discount_type ?? 0),
      discount_value: Number(rule.discount_type ?? 0) === 0 ? "" : String(rule.discount_value ?? ""),
      year_level_id: Number(rule.year_level_id ?? 0),
      school_year_id: rule.school_year_id == null ? "" : String(rule.school_year_id),
      semester_id: rule.semester_id == null ? "" : String(rule.semester_id),
      status: Number(rule.status ?? 1),
    });
  };

  const handleScholarshipRuleDelete = (ruleId) => {
    if (!canDelete) {
      showSnackbar("You do not have permission to delete this item", "error");
      return;
    }
    setSelectedScholarshipRuleId(ruleId);
    setScholarshipRuleDeleteDialogOpen(true);
  };

  const executeScholarshipRuleDelete = async () => {
    if (!selectedScholarshipRuleId) return;
    try {
      await axios.delete(
        `${API_BASE_URL}/api/tosf/scholarship-fees/${selectedScholarshipRuleId}`,
        permissionHeaders,
      );
      showSnackbar("Scholarship fee deleted successfully!");
      fetchScholarshipRules(selectedScholarshipForRules);
    } catch (error) {
      console.error("Error deleting scholarship fee:", error);
      showSnackbar(error.response?.data?.message || "Error deleting scholarship fee", "error");
    } finally {
      setScholarshipRuleDeleteDialogOpen(false);
      setSelectedScholarshipRuleId(null);
    }
  };

  const handleScholarshipDelete = (id) => {
    if (!canDelete) {
      showSnackbar("You do not have permission to delete this item", "error");
      return;
    }
    setSelectedScholarshipId(id);
    setScholarshipDeleteDialogOpen(true);
  };

  const executeScholarshipDelete = async () => {
    if (!selectedScholarshipId) return;
    if (!canDelete) {
      showSnackbar("You do not have permission to delete this item", "error");
      setScholarshipDeleteDialogOpen(false);
      setSelectedScholarshipId(null);
      return;
    }
    try {
      await axios.delete(`${API_BASE_URL}/api/delete_scholarship_type/${selectedScholarshipId}`, permissionHeaders);
      showSnackbar("Scholarship type deleted successfully!");
      fetchScholarshipTypes();
    } catch (error) {
      console.error("Error deleting scholarship type:", error);
      showSnackbar("Error deleting scholarship type", "error");
    } finally {
      setScholarshipDeleteDialogOpen(false);
      setSelectedScholarshipId(null);
    }
  };

  const executeScholarshipRuleUpdate = async () => {
    setScholarshipRuleUpdateDialogOpen(false);
    await saveScholarshipRule();
  };

  // ---------------------------------------------------------------------
  // NEW: tab navigation state (purely visual — groups the six sections
  // into three focused workspaces instead of one long page)
  // ---------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState(0);

  // NEW: Fee Groups / Account Types CRUD now lives in modals, triggered from
  // the Fee Catalog section header, instead of taking up their own tab.
  const [feeGroupsModalOpen, setFeeGroupsModalOpen] = useState(false);
  const [accountTypesModalOpen, setAccountTypesModalOpen] = useState(false);

  // ✅ Access Guards
  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Checking Access..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
  }

  const showCreateActions = canCreate;
  const showActionColumn = canEdit || canDelete;
  const getFeeCategoryLabel = (value) =>
    feeCategoryOptions.find((option) => Number(option.value) === Number(value))?.label || "-";
  const getFeeGroupLabel = (fee) =>
    fee.fee_group_description
      || feeGroups.find((item) => String(item.id) === String(fee.fee_group))?.description
      || "-";
  const getAccountTypeLabel = (fee) =>
    fee.account_type_description
      || accountTypes.find((item) => String(item.id) === String(fee.account_type))?.description
      || "-";
  const getAppliedToLabel = (value) =>
    Number(value) === 0
      ? "All Year Level"
      : yearLevelOptions.find((level) => String(level.year_level_id) === String(value))
        ?.year_level_description || "-";
  const getBranchLabel = (value) =>
    branches.find((branch) => String(branch.id) === String(value))?.branch || "All Branches";
  const getScholarshipFeeRateLabel = (rule) => {
    const rate = feeRates.find((item) => String(item.fee_rate_id) === String(rule.fee_rate_id));
    if (rate) {
      return `${rate.fee_code || ""}${rate.fee_code ? " - " : ""}${rate.fee_name || "Fee"} (${Number(rate.amount || 0).toLocaleString()})`;
    }
    return rule.fee_name || rule.fee_code || rule.fee_rate_id || "-";
  };
  const getScholarshipYearLevelLabel = (value) =>
    Number(value) === 0
      ? "All Year Level"
      : scholarshipRuleOptions.yearLevels.find((level) => String(level.year_level_id) === String(value))
        ?.year_level_description || value || "-";
  const getScholarshipSchoolYearLabel = (value) => {
    const schoolYear = scholarshipRuleOptions.schoolYears.find((item) => String(item.year_id) === String(value));
    return formatScholarshipAcademicYear(schoolYear) || value || "-";
  };
  const getScholarshipSemesterLabel = (value) =>
    scholarshipRuleOptions.semesters.find((item) => String(item.semester_id) === String(value))
      ?.semester_description || value || "-";
  const getScholarshipDiscountTypeLabel = (value) => {
    const labels = {
      0: "Full Discount",
      1: "Percentage",
      2: "Number",
    };
    return labels[Number(value)] || "Full Discount";
  };
  const formatScholarshipAcademicYear = (year) => {
    if (!year) return "";
    if (typeof year === "object") {
      if (year.current_year != null && year.next_year != null) {
        return `${year.current_year} - ${year.next_year}`;
      }
      return formatScholarshipAcademicYear(year.year_description);
    }
    if (typeof year === "string" && year.includes("-")) return year;

    const startYear = Number(year);
    if (Number.isNaN(startYear)) return "";

    return `${startYear} - ${startYear + 1}`;
  };

  const headerColor = settings?.header_color || "#1976d2";

  return (
    <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", backgroundColor: "transparent", mt: 1, p: { xs: 1.5, md: 2.5 } }}>
      {/* Page header */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: titleColor, fontSize: { xs: "24px", md: "30px" } }}>
            Tuition Fee Management
          </Typography>
          <Typography sx={{ color: subtitleColor, fontSize: "0.85rem", mt: 0.3 }}>
            Configure fees, rate schedules, and scholarship discounts in one place.
          </Typography>
        </Box>
      </Stack>

      {/* Tab navigation — replaces the long single-page stack of six sections */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 3,
          minHeight: 40,
          borderBottom: "1px solid #eef0f3",
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
            minHeight: 40,
            gap: 0.75,
          },
          "& .Mui-selected": { color: `${headerColor} !important` },
          "& .MuiTabs-indicator": { backgroundColor: headerColor, height: 3, borderRadius: "3px 3px 0 0" },
        }}
      >
        <Tab icon={<ReceiptLongIcon fontSize="small" />} iconPosition="start" label="Fees & Rates" />
        <Tab icon={<SchoolIcon fontSize="small" />} iconPosition="start" label="Scholarships" />
      </Tabs>

      {/* ================================================================ */}
      {/* TAB 0 — FEE CATALOG + FEE RATES                                  */}
      {/* ================================================================ */}
      {activeTab === 0 && (
        <Box>
          <Card sx={cardSx(borderColor)}>
            <SectionHeading
              icon={<ReceiptLongIcon />}
              title="Fee Catalog"
              subtitle="Define the fees available for assignment (tuition, misc, and other charges)."
              accentColor={headerColor}
              actions={
                <>
                  <Button
                    onClick={() => setFeeGroupsModalOpen(true)}
                    variant="outlined"
                    size="small"
                    startIcon={<CategoryIcon fontSize="small" />}
                    sx={{ textTransform: "none", borderRadius: "8px", borderColor: `${headerColor}55`, color: headerColor }}
                  >
                    Fee Groups
                  </Button>
                  <Button
                    onClick={() => setAccountTypesModalOpen(true)}
                    variant="outlined"
                    size="small"
                    startIcon={<AccountBalanceIcon fontSize="small" />}
                    sx={{ textTransform: "none", borderRadius: "8px", borderColor: `${headerColor}55`, color: headerColor }}
                  >
                    Account Types
                  </Button>
                </>
              }
            />
            <form onSubmit={handleFeeCatalogSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4} md={3}>
                  <Typography sx={fieldLabelSx}>FEE CODE</Typography>
                  <TextField name="fee_code" value={feeCatalogForm.fee_code} onChange={handleFeeCatalogChange} size="small" fullWidth required />
                </Grid>
                <Grid item xs={12} sm={8} md={5}>
                  <Typography sx={fieldLabelSx}>FEE NAME</Typography>
                  <TextField name="fee_name" value={feeCatalogForm.fee_name} onChange={handleFeeCatalogChange} size="small" fullWidth required />
                </Grid>
                <Grid item xs={12} sm={4} md={2}>
                  <Typography sx={fieldLabelSx}>CATEGORY</Typography>
                  <TextField select SelectProps={{ native: true }} name="fee_category" value={feeCatalogForm.fee_category} onChange={handleFeeCatalogChange} size="small" fullWidth>
                    {feeCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={4} md={1}>
                  <Typography sx={fieldLabelSx}>ORDER</Typography>
                  <TextField name="sort_order" type="number" value={feeCatalogForm.sort_order} onChange={handleFeeCatalogChange} size="small" fullWidth />
                </Grid>
                <Grid item xs={6} sm={4} md={1}>
                  <Typography sx={fieldLabelSx}>STATUS</Typography>
                  <TextField select SelectProps={{ native: true }} name="is_active" value={feeCatalogForm.is_active} onChange={handleFeeCatalogChange} size="small" fullWidth>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography sx={fieldLabelSx}>FEE GROUP</Typography>
                  <TextField select SelectProps={{ native: true }} name="fee_group" value={feeCatalogForm.fee_group} onChange={handleFeeCatalogChange} size="small" fullWidth>
                    <option value="">Select Fee Group</option>
                    {feeGroups.map((item) => (
                      <option key={item.id} value={item.id}>{item.description}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography sx={fieldLabelSx}>ACCOUNT TYPE</Typography>
                  <TextField select SelectProps={{ native: true }} name="account_type" value={feeCatalogForm.account_type} onChange={handleFeeCatalogChange} size="small" fullWidth>
                    <option value="">Select Account Type</option>
                    {accountTypes.map((item) => (
                      <option key={item.id} value={item.id}>{item.description}</option>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, textAlign: "right" }}>
                {showCreateActions && (
                  <Button type="submit" variant="contained" startIcon={<SaveIcon fontSize="small" />} sx={{ textTransform: "none", borderRadius: "8px", backgroundColor: headerColor }}>
                    Save Fee
                  </Button>
                )}
              </Box>
            </form>

            <Divider sx={{ my: 3 }} />

            <CleanTable
              headers={["Order", "Code", "Name", "Category", "Fee Group", "Account Type", "Status", "Rates", "Actions"]}
              showActionColumn={showActionColumn}
              headerColor={headerColor}
              emptyMessage="No dynamic fees found."
            >
              {feeCatalog.map((fee) => (
                <TableRow key={fee.fee_id}>
                  <TableCell>{fee.sort_order}</TableCell>
                  <TableCell>{fee.fee_code}</TableCell>
                  <TableCell>{fee.fee_name}</TableCell>
                  <TableCell>{getFeeCategoryLabel(fee.fee_category)}</TableCell>
                  <TableCell>{getFeeGroupLabel(fee)}</TableCell>
                  <TableCell>{getAccountTypeLabel(fee)}</TableCell>
                  <TableCell><StatusChip active={Number(fee.is_active) === 1} /></TableCell>
                  <TableCell>{fee.rate_count || 0}</TableCell>
                  {showActionColumn && (
                    <TableCell>
                      <RowActions canEdit={canEdit} canDelete={canDelete} onEdit={() => handleFeeCatalogEdit(fee)} onDelete={() => handleFeeCatalogDelete(fee)} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </CleanTable>
          </Card>

          <Card sx={cardSx(borderColor)}>
            <SectionHeading
              icon={<PriceChangeIcon />}
              title="Fee Rates"
              subtitle="Set the amount a fee charges per branch, curriculum scope, and year level."
              accentColor={headerColor}
            />
            <form onSubmit={handleFeeRateSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography sx={fieldLabelSx}>FEE</Typography>
                  <TextField select SelectProps={{ native: true }} name="fee_id" value={feeRateForm.fee_id} onChange={handleFeeRateChange} size="small" fullWidth required>
                    <option value="">Select Fee</option>
                    {feeCatalog.map((fee) => (
                      <option key={fee.fee_id} value={fee.fee_id}>{fee.fee_code} - {fee.fee_name}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <Typography sx={fieldLabelSx}>AMOUNT</Typography>
                  <TextField name="amount" type="number" value={feeRateForm.amount} onChange={handleFeeRateChange} size="small" fullWidth required inputProps={{ inputMode: "numeric", pattern: "[0-9]*", step: 1, min: 0 }} />
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  <Typography sx={fieldLabelSx}>YEAR LEVEL</Typography>
                  <TextField select SelectProps={{ native: true }} name="applied_to" value={feeRateForm.applied_to} onChange={handleFeeRateChange} size="small" fullWidth>
                    <option value={0}>All Year Level</option>
                    {yearLevelOptions.map((level) => (
                      <option key={level.year_level_id} value={level.year_level_id}>{level.year_level_description}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography sx={fieldLabelSx}>BRANCH</Typography>
                  <TextField select SelectProps={{ native: true }} name="branch_id" value={feeRateForm.branch_id} onChange={handleFeeRateChange} size="small" fullWidth>
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.branch}</option>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={6} sm={4} md={3}>
                  <Typography sx={fieldLabelSx}>SCOPE</Typography>
                  <TextField select SelectProps={{ native: true }} name="applies_to_all" value={feeRateForm.applies_to_all} onChange={handleFeeRateChange} size="small" fullWidth>
                    <option value={1}>All Curricula</option>
                    <option value={0}>Specific Curriculum</option>
                  </TextField>
                </Grid>
                {Number(feeRateForm.applies_to_all) === 0 && (
                  <Grid item xs={12} sm={8} md={6}>
                    <Typography sx={fieldLabelSx}>DEPARTMENT CURRICULUM</Typography>
                    <TextField select SelectProps={{ native: true }} name="dprtmnt_curriculum_id" value={feeRateForm.dprtmnt_curriculum_id} onChange={handleFeeRateChange} size="small" fullWidth required>
                      <option value="">Select Curriculum</option>
                      {curriculumOptions.map((item) => (
                        <option key={item.dprtmnt_curriculum_id} value={item.dprtmnt_curriculum_id}>
                          {item.dprtmnt_name} - ({item.program_code}) {item.program_description} {item.major || ""} - {item.year_description}
                        </option>
                      ))}
                    </TextField>
                  </Grid>
                )}
                <Grid item xs={6} sm={4} md={3}>
                  <Typography sx={fieldLabelSx}>STATUS</Typography>
                  <TextField select SelectProps={{ native: true }} name="is_active" value={feeRateForm.is_active} onChange={handleFeeRateChange} size="small" fullWidth>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </TextField>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, textAlign: "right" }}>
                {showCreateActions && (
                  <Button type="submit" variant="contained" startIcon={<SaveIcon fontSize="small" />} sx={{ textTransform: "none", borderRadius: "8px", backgroundColor: headerColor }}>
                    Add Rate
                  </Button>
                )}
              </Box>
            </form>

            <Divider sx={{ my: 3 }} />

            <CleanTable
              headers={["ID", "Fee", "Amount", "Year Level", "Scope / Department Curriculum", "Branch", "Status", "Actions"]}
              showActionColumn={showActionColumn}
              headerColor={headerColor}
              emptyMessage="No fee rates found."
            >
              {feeRates.map((rate, index) => (
                <TableRow key={rate.fee_rate_id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{rate.fee_code} - {rate.fee_name}</TableCell>
                  <TableCell>{Number(rate.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>{getAppliedToLabel(rate.applied_to)}</TableCell>
                  <TableCell>
                    {Number(rate.applies_to_all) === 1
                      ? "All Curricula"
                      : `${rate.dprtmnt_name || ""} - ${rate.program_code || ""} ${rate.year_description || ""}`}
                  </TableCell>
                  <TableCell>{getBranchLabel(rate.branch_id)}</TableCell>
                  <TableCell><StatusChip active={Number(rate.is_active) === 1} /></TableCell>
                  {showActionColumn && (
                    <TableCell>
                      <RowActions canEdit={canEdit} canDelete={canDelete} onEdit={() => handleFeeRateEdit(rate)} onDelete={() => handleFeeRateDelete(rate)} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </CleanTable>
          </Card>
        </Box>
      )}

      {/* ================================================================ */}
      {/* TAB 1 — SCHOLARSHIP TYPES + RULES                                 */}
      {/* ================================================================ */}
      {activeTab === 1 && (
        <Box>
          <Card sx={cardSx(borderColor)}>
            <SectionHeading icon={<SchoolIcon />} title="Scholarship Types" subtitle="Define the scholarships available to students." accentColor={headerColor} />
            <form onSubmit={handleScholarshipSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Typography sx={fieldLabelSx}>SCHOLARSHIP NAME</Typography>
                  <TextField name="scholarship_name" value={scholarshipForm.scholarship_name} onChange={handleScholarshipChange} size="small" required fullWidth />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography sx={fieldLabelSx}>STATUS</Typography>
                  <TextField select SelectProps={{ native: true }} name="scholarship_status" value={scholarshipForm.scholarship_status} onChange={handleScholarshipChange} size="small" fullWidth>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </TextField>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, textAlign: "right" }}>
                {(showCreateActions || (editingScholarshipId && canEdit)) && (
                  <Button type="submit" variant="contained" sx={{ textTransform: "none", borderRadius: "8px", backgroundColor: headerColor }}>
                    {editingScholarshipId ? "Update Scholarship Type" : (<><SaveIcon fontSize="small" sx={{ mr: 0.5 }} /> Save</>)}
                  </Button>
                )}
                {editingScholarshipId && (
                  <Button onClick={resetScholarshipForm} color="error" variant="outlined" startIcon={<CloseIcon fontSize="small" />} sx={{ ml: 2, textTransform: "none", borderRadius: "8px" }}>
                    Cancel
                  </Button>
                )}
              </Box>
            </form>

            <Divider sx={{ my: 3 }} />

            <CleanTable headers={["ID", "Scholarship Name", "Status", "Created At", "Actions"]} showActionColumn={showActionColumn} headerColor={headerColor} emptyMessage="No scholarship types found.">
              {scholarshipTypes.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.scholarship_name}</TableCell>
                  <TableCell><StatusChip active={Number(item.scholarship_status) === 1} /></TableCell>
                  <TableCell>{item.created_at ? new Date(Number(item.created_at) * 1000).toLocaleString() : "-"}</TableCell>
                  {showActionColumn && (
                    <TableCell>
                      <RowActions canEdit={canEdit} canDelete={canDelete} onEdit={() => handleScholarshipEdit(item)} onDelete={() => handleScholarshipDelete(item.id)} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </CleanTable>
          </Card>

          <Card sx={cardSx(borderColor)}>
            <SectionHeading icon={<RuleIcon />} title="Scholarship Fees" subtitle="Assign scholarship discounts to fee rates by year level, school year, and semester." accentColor={headerColor} />

            <Box
              sx={{
                mb: 2.5,
                p: 2,
                borderRadius: "10px",
                backgroundColor: "#f6f8fa",
                border: "1px solid #eef0f3",
              }}
            >
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} md={6}>
                  <Typography sx={fieldLabelSx}>STEP 1 · SELECT SCHOLARSHIP</Typography>
                  <TextField
                    select
                    SelectProps={{ native: true }}
                    value={selectedScholarshipForRules}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSelectedScholarshipForRules(next);
                      setScholarshipRuleForm((prev) => ({ ...prev, scholarship_id: next }));
                      setEditingScholarshipRuleId(null);
                      fetchScholarshipRules(next);
                    }}
                    size="small"
                    fullWidth
                  >
                    <option value="">-- Select --</option>
                    {scholarshipTypes.map((s) => (
                      <option key={s.id} value={s.id}>{s.scholarship_name}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
                    Choose a scholarship above, then assign the fee rate it discounts.
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            <form onSubmit={handleScholarshipRuleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography sx={fieldLabelSx}>FEE RATE</Typography>
                  <TextField select SelectProps={{ native: true }} name="fee_rate_id" value={scholarshipRuleForm.fee_rate_id} onChange={handleScholarshipRuleChange} size="small" fullWidth required>
                    <option value="">Select Fee Rate</option>
                    {feeRates.map((rate) => (
                      <option key={rate.fee_rate_id} value={rate.fee_rate_id}>
                        {rate.fee_code} - {rate.fee_name} ({Number(rate.amount || 0).toLocaleString()})
                      </option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography sx={fieldLabelSx}>DISCOUNT TYPE</Typography>
                  <TextField select SelectProps={{ native: true }} name="discount_type" value={scholarshipRuleForm.discount_type} onChange={handleScholarshipRuleChange} size="small" fullWidth>
                    <option value={0}>Full Discount</option>
                    <option value={1}>Percentage</option>
                    <option value={2}>Number</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography sx={fieldLabelSx}>DISCOUNT VALUE</Typography>
                  <TextField
                    name="discount_value"
                    type="number"
                    value={scholarshipRuleForm.discount_value}
                    onChange={handleScholarshipRuleChange}
                    size="small"
                    fullWidth
                    disabled={Number(scholarshipRuleForm.discount_type) === 0}
                    required={Number(scholarshipRuleForm.discount_type) !== 0}
                    placeholder={Number(scholarshipRuleForm.discount_type) === 0 ? "Full discount" : ""}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*", step: 1, min: 0 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Typography sx={fieldLabelSx}>STATUS</Typography>
                  <TextField select SelectProps={{ native: true }} name="status" value={scholarshipRuleForm.status} onChange={handleScholarshipRuleChange} size="small" fullWidth>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Typography sx={fieldLabelSx}>YEAR LEVEL</Typography>
                  <TextField select SelectProps={{ native: true }} name="year_level_id" value={scholarshipRuleForm.year_level_id} onChange={handleScholarshipRuleChange} size="small" fullWidth>
                    <option value={0}>All</option>
                    {scholarshipRuleOptions.yearLevels.map((yl) => (
                      <option key={yl.year_level_id} value={yl.year_level_id}>{yl.year_level_description}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <Typography sx={fieldLabelSx}>SCHOOL YEAR</Typography>
                  <TextField select SelectProps={{ native: true }} name="school_year_id" value={scholarshipRuleForm.school_year_id} onChange={handleScholarshipRuleChange} size="small" fullWidth required>
                    <option value="">Select School Year</option>
                    {scholarshipRuleOptions.schoolYears.map((sy) => (
                      <option key={sy.year_id} value={sy.year_id}>
                        {formatScholarshipAcademicYear(sy) || sy.year_id}
                      </option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <Typography sx={fieldLabelSx}>SEMESTER</Typography>
                  <TextField select SelectProps={{ native: true }} name="semester_id" value={scholarshipRuleForm.semester_id} onChange={handleScholarshipRuleChange} size="small" fullWidth required>
                    <option value="">Select Semester</option>
                    {scholarshipRuleOptions.semesters.map((sem) => (
                      <option key={sem.semester_id} value={sem.semester_id}>{sem.semester_description}</option>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, textAlign: "right" }}>
                {(showCreateActions || (editingScholarshipRuleId && canEdit)) && (
                  <Button type="submit" variant="contained" sx={{ textTransform: "none", borderRadius: "8px", backgroundColor: headerColor }}>
                    {editingScholarshipRuleId ? "Update Fee" : (<><SaveIcon fontSize="small" sx={{ mr: 0.5 }} /> Save</>)}
                  </Button>
                )}
                {editingScholarshipRuleId && (
                  <Button onClick={resetScholarshipRuleForm} color="error" variant="outlined" startIcon={<CloseIcon fontSize="small" />} sx={{ ml: 2, textTransform: "none", borderRadius: "8px" }}>
                    Cancel
                  </Button>
                )}
              </Box>
            </form>

            <Divider sx={{ my: 3 }} />

            <CleanTable
              headers={["ID", "Fee Rate", "Discount Type", "Discount Value", "Year Level", "School Year", "Semester", "Status", "Actions"]}
              showActionColumn={showActionColumn}
              headerColor={headerColor}
              emptyMessage={selectedScholarshipForRules ? "No scholarship fees found." : "Select a scholarship to manage fees."}
              colSpanOverride={showActionColumn ? 9 : 8}
            >
              {selectedScholarshipForRules && scholarshipRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.id}</TableCell>
                  <TableCell>{getScholarshipFeeRateLabel(rule)}</TableCell>
                  <TableCell>{getScholarshipDiscountTypeLabel(rule.discount_type)}</TableCell>
                  <TableCell>{rule.discount_value == null ? "-" : Number(rule.discount_value || 0).toLocaleString()}</TableCell>
                  <TableCell>{getScholarshipYearLevelLabel(rule.year_level_id)}</TableCell>
                  <TableCell>{getScholarshipSchoolYearLabel(rule.school_year_id)}</TableCell>
                  <TableCell>{getScholarshipSemesterLabel(rule.semester_id)}</TableCell>
                  <TableCell><StatusChip active={Number(rule.status) === 1} /></TableCell>
                  {showActionColumn && (
                    <TableCell>
                      <RowActions canEdit={canEdit} canDelete={canDelete} onEdit={() => handleScholarshipRuleEdit(rule)} onDelete={() => handleScholarshipRuleDelete(rule.id)} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </CleanTable>
          </Card>
        </Box>
      )}

      {/* ================================================================ */}
      {/* DIALOGS (unchanged logic, lightly restyled)                       */}
      {/* ================================================================ */}

      {/* Fee Groups — CRUD modal, opened from the Fee Catalog header */}
      <Dialog open={feeGroupsModalOpen} onClose={() => setFeeGroupsModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <CategoryIcon fontSize="small" sx={{ color: headerColor }} />
          Fee Groups
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mb: 2 }}>
            Group fees together for reporting and display.
          </Typography>
          <form onSubmit={handleFeeGroupSubmit}>
            <Typography sx={fieldLabelSx}>DESCRIPTION</Typography>
            <Stack direction="row" spacing={1.5}>
              <TextField name="description" value={feeGroupForm.description} onChange={handleFeeGroupChange} size="small" fullWidth required inputProps={{ maxLength: 60 }} />
              {showCreateActions && (
                <Button type="submit" variant="contained" sx={{ textTransform: "none", borderRadius: "8px", backgroundColor: headerColor, whiteSpace: "nowrap" }}>
                  <SaveIcon fontSize="small" />
                </Button>
              )}
            </Stack>
          </form>

          <Divider sx={{ my: 3 }} />

          <CleanTable headers={["#", "Description", "Actions"]} showActionColumn={showActionColumn} headerColor={headerColor} emptyMessage="No fee groups found.">
            {feeGroups.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{item.description}</TableCell>
                {showActionColumn && (
                  <TableCell>
                    <RowActions canEdit={canEdit} canDelete={canDelete} onEdit={() => handleFeeGroupEdit(item)} onDelete={() => handleFeeGroupDelete(item)} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </CleanTable>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFeeGroupsModalOpen(false)} variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Types — CRUD modal, opened from the Fee Catalog header */}
      <Dialog open={accountTypesModalOpen} onClose={() => setAccountTypesModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <AccountBalanceIcon fontSize="small" sx={{ color: headerColor }} />
          Account Types
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mb: 2 }}>
            Classify fees by the accounting bucket they post to.
          </Typography>
          <form onSubmit={handleAccountTypeSubmit}>
            <Typography sx={fieldLabelSx}>DESCRIPTION</Typography>
            <Stack direction="row" spacing={1.5}>
              <TextField name="description" value={accountTypeForm.description} onChange={handleAccountTypeChange} size="small" fullWidth required inputProps={{ maxLength: 60 }} />
              {showCreateActions && (
                <Button type="submit" variant="contained" sx={{ textTransform: "none", borderRadius: "8px", backgroundColor: headerColor, whiteSpace: "nowrap" }}>
                  <SaveIcon fontSize="small" />
                </Button>
              )}
            </Stack>
          </form>

          <Divider sx={{ my: 3 }} />

          <CleanTable headers={["#", "Description", "Actions"]} showActionColumn={showActionColumn} headerColor={headerColor} emptyMessage="No account types found.">
            {accountTypes.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{item.description}</TableCell>
                {showActionColumn && (
                  <TableCell>
                    <RowActions canEdit={canEdit} canDelete={canDelete} onEdit={() => handleAccountTypeEdit(item)} onDelete={() => handleAccountTypeDelete(item)} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </CleanTable>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAccountTypesModalOpen(false)} variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={feeCatalogEditDialogOpen} onClose={closeFeeCatalogEditDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Fee</DialogTitle>
        <form onSubmit={handleFeeCatalogEditSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={4}>
                <Typography sx={fieldLabelSx}>FEE CODE</Typography>
                <TextField name="fee_code" value={feeCatalogEditForm.fee_code} onChange={handleFeeCatalogEditChange} size="small" fullWidth required />
              </Grid>
              <Grid item xs={12} md={8}>
                <Typography sx={fieldLabelSx}>FEE NAME</Typography>
                <TextField name="fee_name" value={feeCatalogEditForm.fee_name} onChange={handleFeeCatalogEditChange} size="small" fullWidth required />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography sx={fieldLabelSx}>CATEGORY</Typography>
                <TextField select SelectProps={{ native: true }} name="fee_category" value={feeCatalogEditForm.fee_category} onChange={handleFeeCatalogEditChange} size="small" fullWidth>
                  {feeCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography sx={fieldLabelSx}>FEE GROUP</Typography>
                <TextField select SelectProps={{ native: true }} name="fee_group" value={feeCatalogEditForm.fee_group} onChange={handleFeeCatalogEditChange} size="small" fullWidth>
                  <option value="">Select Fee Group</option>
                  {feeGroups.map((item) => (
                    <option key={item.id} value={item.id}>{item.description}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography sx={fieldLabelSx}>ACCOUNT TYPE</Typography>
                <TextField select SelectProps={{ native: true }} name="account_type" value={feeCatalogEditForm.account_type} onChange={handleFeeCatalogEditChange} size="small" fullWidth>
                  <option value="">Select Account Type</option>
                  {accountTypes.map((item) => (
                    <option key={item.id} value={item.id}>{item.description}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>ORDER</Typography>
                <TextField name="sort_order" type="number" value={feeCatalogEditForm.sort_order} onChange={handleFeeCatalogEditChange} size="small" fullWidth />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>STATUS</Typography>
                <TextField select SelectProps={{ native: true }} name="is_active" value={feeCatalogEditForm.is_active} onChange={handleFeeCatalogEditChange} size="small" fullWidth>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeFeeCatalogEditDialog} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
            <Button type="submit" variant="contained" color="warning" sx={{ textTransform: "none", borderRadius: "8px" }}>Update Fee</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={feeGroupEditDialogOpen} onClose={closeFeeGroupEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Fee Group</DialogTitle>
        <form onSubmit={handleFeeGroupEditSubmit}>
          <DialogContent>
            <Typography sx={fieldLabelSx}>DESCRIPTION</Typography>
            <TextField name="description" value={feeGroupEditForm.description} onChange={handleFeeGroupEditChange} size="small" fullWidth required inputProps={{ maxLength: 60 }} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeFeeGroupEditDialog} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
            <Button type="submit" variant="contained" color="warning" sx={{ textTransform: "none", borderRadius: "8px" }}>Update Fee Group</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={accountTypeEditDialogOpen} onClose={closeAccountTypeEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Account Type</DialogTitle>
        <form onSubmit={handleAccountTypeEditSubmit}>
          <DialogContent>
            <Typography sx={fieldLabelSx}>DESCRIPTION</Typography>
            <TextField name="description" value={accountTypeEditForm.description} onChange={handleAccountTypeEditChange} size="small" fullWidth required inputProps={{ maxLength: 60 }} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeAccountTypeEditDialog} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
            <Button type="submit" variant="contained" color="warning" sx={{ textTransform: "none", borderRadius: "8px" }}>Update Account Type</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={feeRateEditDialogOpen} onClose={closeFeeRateEditDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Fee Rate</DialogTitle>
        <form onSubmit={handleFeeRateEditSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>FEE</Typography>
                <TextField select SelectProps={{ native: true }} name="fee_id" value={feeRateEditForm.fee_id} onChange={handleFeeRateEditChange} size="small" fullWidth required>
                  <option value="">Select Fee</option>
                  {feeCatalog.map((fee) => (
                    <option key={fee.fee_id} value={fee.fee_id}>{fee.fee_code} - {fee.fee_name}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>AMOUNT</Typography>
                <TextField name="amount" type="number" value={feeRateEditForm.amount} onChange={handleFeeRateEditChange} size="small" fullWidth required inputProps={{ inputMode: "numeric", pattern: "[0-9]*", step: 1, min: 0 }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>YEAR LEVEL</Typography>
                <TextField select SelectProps={{ native: true }} name="applied_to" value={feeRateEditForm.applied_to} onChange={handleFeeRateEditChange} size="small" fullWidth>
                  <option value={0}>All Year Level</option>
                  {yearLevelOptions.map((level) => (
                    <option key={level.year_level_id} value={level.year_level_id}>{level.year_level_description}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>SCOPE</Typography>
                <TextField select SelectProps={{ native: true }} name="applies_to_all" value={feeRateEditForm.applies_to_all} onChange={handleFeeRateEditChange} size="small" fullWidth>
                  <option value={1}>All Curricula</option>
                  <option value={0}>Specific Curriculum</option>
                </TextField>
              </Grid>
              {Number(feeRateEditForm.applies_to_all) === 0 && (
                <Grid item xs={12}>
                  <Typography sx={fieldLabelSx}>DEPARTMENT CURRICULUM</Typography>
                  <TextField select SelectProps={{ native: true }} name="dprtmnt_curriculum_id" value={feeRateEditForm.dprtmnt_curriculum_id} onChange={handleFeeRateEditChange} size="small" fullWidth required>
                    <option value="">Select Curriculum</option>
                    {curriculumOptions.map((item) => (
                      <option key={item.dprtmnt_curriculum_id} value={item.dprtmnt_curriculum_id}>
                        {item.dprtmnt_name} - ({item.program_code}) {item.program_description} {item.major || ""} - {item.year_description}
                      </option>
                    ))}
                  </TextField>
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>BRANCH</Typography>
                <TextField select SelectProps={{ native: true }} name="branch_id" value={feeRateEditForm.branch_id} onChange={handleFeeRateEditChange} size="small" fullWidth>
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.branch}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography sx={fieldLabelSx}>STATUS</Typography>
                <TextField select SelectProps={{ native: true }} name="is_active" value={feeRateEditForm.is_active} onChange={handleFeeRateEditChange} size="small" fullWidth>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeFeeRateEditDialog} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
            <Button type="submit" variant="contained" color="warning" sx={{ textTransform: "none", borderRadius: "8px" }}>Update Rate</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={feeCatalogDeleteDialogOpen} onClose={() => { setFeeCatalogDeleteDialogOpen(false); setSelectedFeeCatalog(null); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Fee</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedFeeCatalog?.fee_name || "this fee"}?
            This is dangerous because all rate records connected to this fee will also be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setFeeCatalogDeleteDialogOpen(false); setSelectedFeeCatalog(null); }} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={executeFeeCatalogDelete} color="error" sx={{ textTransform: "none" }}>Delete Fee</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={feeGroupDeleteDialogOpen} onClose={() => { setFeeGroupDeleteDialogOpen(false); setSelectedFeeGroup(null); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Fee Group</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedFeeGroup?.description || "this fee group"}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setFeeGroupDeleteDialogOpen(false); setSelectedFeeGroup(null); }} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={executeFeeGroupDelete} color="error" sx={{ textTransform: "none" }}>Delete Fee Group</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={accountTypeDeleteDialogOpen} onClose={() => { setAccountTypeDeleteDialogOpen(false); setSelectedAccountType(null); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Account Type</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedAccountType?.description || "this account type"}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setAccountTypeDeleteDialogOpen(false); setSelectedAccountType(null); }} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={executeAccountTypeDelete} color="error" sx={{ textTransform: "none" }}>Delete Account Type</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={feeRateDeleteDialogOpen} onClose={() => { setFeeRateDeleteDialogOpen(false); setSelectedFeeRate(null); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Fee Rate</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this fee rate? This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setFeeRateDeleteDialogOpen(false); setSelectedFeeRate(null); }} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={executeFeeRateDelete} color="error" sx={{ textTransform: "none" }}>Delete Rate</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={scholarshipUpdateDialogOpen} onClose={() => setScholarshipUpdateDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Update</DialogTitle>
        <DialogContent>
          <DialogContentText>Do you want to save the updated scholarship type?</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScholarshipUpdateDialogOpen(false)} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={async () => { setScholarshipUpdateDialogOpen(false); await saveScholarshipType(); }} variant="contained" color="warning" sx={{ textTransform: "none", borderRadius: "8px" }}>Yes, Update</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scholarshipDeleteDialogOpen} onClose={() => { setScholarshipDeleteDialogOpen(false); setSelectedScholarshipId(null); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this scholarship type? This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setScholarshipDeleteDialogOpen(false); setSelectedScholarshipId(null); }} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={executeScholarshipDelete} color="error" sx={{ textTransform: "none" }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scholarshipRuleUpdateDialogOpen} onClose={() => setScholarshipRuleUpdateDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Update</DialogTitle>
        <DialogContent>
          <DialogContentText>Do you want to save the updated scholarship fee?</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScholarshipRuleUpdateDialogOpen(false)} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={executeScholarshipRuleUpdate} variant="contained" color="warning" sx={{ textTransform: "none", borderRadius: "8px" }}>Yes, Update</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scholarshipRuleDeleteDialogOpen} onClose={() => { setScholarshipRuleDeleteDialogOpen(false); setSelectedScholarshipRuleId(null); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this scholarship fee? This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setScholarshipRuleDeleteDialogOpen(false); setSelectedScholarshipRuleId(null); }} color="error" variant="outlined" sx={{ textTransform: "none", borderRadius: "8px" }}>Cancel</Button>
          <Button onClick={executeScholarshipRuleDelete} color="error" sx={{ textTransform: "none" }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TOSF;    

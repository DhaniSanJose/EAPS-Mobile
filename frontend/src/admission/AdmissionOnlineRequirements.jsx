import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from 'axios';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TextField,
  DialogActions,
  Dialog,
  DialogContent,
  DialogTitle,
  TableRow,
  MenuItem,
  Modal,
  IconButton
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import API_BASE_URL from "../apiConfig";
import { getAuditConfig, getFlatAuditHeaders } from "../utils/auditEvents";
import useAuditMac from "../utils/useAuditMac";
import { getLoginMacPayload } from "../utils/userMacAddress";
import { Link, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Snackbar, Alert } from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PeopleIcon from "@mui/icons-material/People";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import AdmissionProcessTabs from "../components/AdmissionProcessTabs";
import SearchIcon from "@mui/icons-material/Search";
import KeyIcon from "@mui/icons-material/Key";
import CampaignIcon from '@mui/icons-material/Campaign';
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";

const StudentRequirements = () => {
  useAuditMac();
  const navigate = useNavigate();
  // ------------------------------------
  const [requirements, setRequirements] = useState([]);

  // -------------------------------------







  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success", // success | error | warning | info
  });

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const [explicitSelection, setExplicitSelection] = useState(false);

  const fetchByPersonId = async (personID) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/person_with_applicant/${personID}`);
      setPerson(res.data);
      setSelectedPerson(res.data);
      if (res.data?.applicant_number) {
        await fetchUploadsByApplicantNumber(res.data.applicant_number);
      }
    } catch (err) {
      console.error("❌ person_with_applicant failed:", err);
    }
  };

  const location = useLocation();
  const [uploads, setUploads] = useState([]);
  const [persons, setPersons] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState({});
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [remarksMap, setRemarksMap] = useState({});
  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [person, setPerson] = useState({
    profile_img: "",
    generalAverage1: "",
    program: "",
    strand: "",
    height: "",
    applyingAs: "",
    document_status: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    extension: "",
    applicant_number: "",
  });

  const [curriculumOptions, setCurriculumOptions] = useState([]);

  useEffect(() => {
    const fetchCurriculums = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/applied_program`);
        setCurriculumOptions(response.data);
      } catch (error) {
        console.error("Error fetching curriculum options:", error);
      }
    };

    fetchCurriculums();
  }, []);

  {
    curriculumOptions.find(
      (item) =>
        item?.curriculum_id?.toString() === (person?.program ?? "").toString()
    )?.program_description || (person?.program ?? "")

  }


  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/requirements`)
      .then((res) => {
        const allRequirements = res.data;

        if (selectedPerson) {
          // Filter by applicant's applyingAs value OR applicant_type === 0
          const filtered = allRequirements.filter(
            (req) => Number(req.applicant_type) === Number(selectedPerson.applyingAs) || Number(req.applicant_type) === 0
          );

          setRequirements(filtered);
        } else {
          // Default filter when no applicant is selected
          const filtered = allRequirements.filter(
            (req) => Number(req.applicant_type) === 1 || Number(req.applicant_type) === 0
          );
          setRequirements(filtered);
        }
      })
      .catch((err) => console.error("Error loading requirements:", err));
  }, [selectedPerson]);


  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const personIdFromUrl = queryParams.get("person_id");

    if (!personIdFromUrl) return;

    // fetch info of that person
    axios
      .get(`${API_BASE_URL}/api/person_with_applicant/${personIdFromUrl}`)
      .then((res) => {
        if (res.data?.applicant_number) {

          // AUTO-INSERT applicant_number into search bar
          setSearchQuery(res.data.applicant_number);

          // If you have a fetchUploads() or fetchExamScore() — call it
          if (typeof fetchUploadsByApplicantNumber === "function") {
            fetchUploadsByApplicantNumber(res.data.applicant_number);
          }

          if (typeof fetchApplicants === "function") {
            fetchApplicants();
          }
        }
      })
      .catch((err) => console.error("Auto search failed:", err));
  }, [location.search]);


  const [editingRemarkId, setEditingRemarkId] = useState(null);
  const [newRemarkMode, setNewRemarkMode] = useState({}); // { [upload_id]: true|false }
  const [documentStatus, setDocumentStatus] = useState("");

  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");   // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000");       // ✅ NEW

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);   // ✅ NEW
    if (settings.stepper_color) setStepperColor(settings.stepper_color);           // ✅ NEW

    // 🏫 Logo
    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}/${settings.logo_url}`);
    } else {
      setFetchedLogo(NPCLogo);
    }

    // 🏷️ School Information
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);

  }, [settings]);

  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const pageId = 61;

  const [employeeID, setEmployeeID] = useState("");

  useEffect(() => {

    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      setEmployeeID(storedEmployeeID);
      if (storedRole === "applicant") {
        setUserID(storedID);
      }

      if (storedRole === "registrar") {
        checkAccess(storedEmployeeID);
      } else if (storedRole !== "applicant" && storedRole !== "superadmin") {
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
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
      setLoading(false);
    }
  };





  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    if (storedRole === "applicant") {
      setUserID(storedID);
    }


    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      if (storedRole === "applicant") {
        setUserID(storedID);
      }

      if (storedRole === "registrar") {

        if (storedID !== "undefined") {

        } else {
          console.warn("Stored person_id is invalid:", storedID);
        }
      } else if (storedRole !== "applicant" && storedRole !== "superadmin") {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);


  const queryParams = new URLSearchParams(location.search);
  const queryPersonId = queryParams.get("person_id")?.trim() || "";

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const loggedInPersonId = localStorage.getItem("person_id");

    if (!storedUser || !storedRole || !loggedInPersonId) {
      window.location.href = "/login";
      return;
    }

    setUser(storedUser);
    setUserRole(storedRole);

    const allowedRoles = ["registrar", "applicant", "superadmin"];
    if (!allowedRoles.includes(storedRole)) {
      window.location.href = "/login";
      return;
    }

    // ⭐ CASE 1: URL HAS ?person_id=
    if (queryPersonId !== "") {
      sessionStorage.setItem("admin_edit_person_id", queryPersonId);
      setUserID(queryPersonId);
      return;
    }

    if (storedRole === "applicant") {
      setUserID(loggedInPersonId);
      return;
    }

    // ⭐ CASE 3: Staff with no URL ID → start blank
    setUserID("");
  }, [queryPersonId]);



  useEffect(() => {
    let consumedFlag = false;

    const tryLoad = async () => {
      if (queryPersonId) {
        await fetchByPersonId(queryPersonId);
        setExplicitSelection(true);
        consumedFlag = true;
        return;
      }

      // fallback only if it's a fresh selection from Applicant List
      const source = sessionStorage.getItem("admin_edit_person_id_source");
      const tsStr = sessionStorage.getItem("admin_edit_person_id_ts");
      const id = sessionStorage.getItem("admin_edit_person_id");
      const ts = tsStr ? parseInt(tsStr, 10) : 0;
      const isFresh =
        ["applicant_list", "admission_applicant_list"].includes(source) &&
        Date.now() - ts < 5 * 60 * 1000;

      if (id && isFresh) {
        await fetchByPersonId(id);
        setExplicitSelection(true);
        consumedFlag = true;
      }
    };

    tryLoad().finally(() => {
      // consume the freshness so it won't auto-load again later
      if (consumedFlag) {
        sessionStorage.removeItem("admin_edit_person_id_source");
        sessionStorage.removeItem("admin_edit_person_id_ts");
      }
    });
  }, [queryPersonId]);


  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // upload | delete | status | documentStatus
  const [targetDoc, setTargetDoc] = useState(null); // document info

  const withAuditActor = (payload) => ({
    ...payload,
    audit_actor_id:
      employeeID ||
      localStorage.getItem("employee_id") ||
      localStorage.getItem("email") ||
      "unknown",
    audit_actor_role: userRole || localStorage.getItem("role") || "registrar",
    ...getLoginMacPayload(),
  });

  const getAuditHeaders = (extraHeaders = {}) =>
    getFlatAuditHeaders({
      "x-employee-id": employeeID || localStorage.getItem("employee_id") || "",
      "x-page-id": pageId,
      "x-audit-actor-id":
        employeeID ||
        localStorage.getItem("employee_id") ||
        localStorage.getItem("email") ||
        "unknown",
      "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
      ...extraHeaders,
    });

  const getUploadStatusLabel = (status) => {
    if (String(status) === "1") return "Verified";
    if (String(status) === "2") return "Rejected";
    return "Pending";
  };


  // When clicking upload
  const handleConfirmUpload = (doc) => {
    if (!canCreate) {
      showSnackbar("You do not have permission to upload documents.", "warning");
      return;
    }
    setTargetDoc(doc);
    setConfirmAction("upload");
    setConfirmOpen(true);
  };

  // When clicking delete
  const handleConfirmDelete = (doc) => {
    setTargetDoc(doc);
    setConfirmAction("delete");
    setConfirmOpen(true);
  };

  // Execute action after confirm
  const handleConfirmAction = async () => {
    if (confirmAction === "upload") {
      await handleUploadSubmit(targetDoc);
      console.log(`Document uploaded by: ${localStorage.getItem("username")}`);
    } else if (confirmAction === "delete") {
      await handleDelete(targetDoc.upload_id);
      console.log(`Document deleted by: ${localStorage.getItem("username")}`);
    } else if (confirmAction === "status") {
      await performStatusChange(targetDoc.upload_id, targetDoc.nextStatus);
    } else if (confirmAction === "documentStatus") {
      await performDocumentStatusChange(targetDoc.nextStatus);
    }

    setConfirmOpen(false);
    setConfirmAction(null);
    setTargetDoc(null);
  };


  useEffect(() => {
    fetchPersons();
  }, []);



  const fetchUploadsByApplicantNumber = async (applicant_number) => {
    if (!applicant_number) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/uploads/by-applicant/${applicant_number}`);
      setUploads(res.data);


    } catch (err) {
      console.error('Fetch uploads failed:', err);
      console.log("Fetching for applicant number:", applicant_number);
    }
  };


  const fetchPersonData = async (personID) => {
    if (!personID || personID === "undefined") {
      console.warn("Invalid personID for person data:", personID);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/person_with_applicant/${personID}`);
      const { evaluator: _evaluator, ...personData } = res.data;
      const safePerson = {
        ...personData,
        document_status: res.data.document_status || "",
        evaluator: null,
      };
      setPerson(safePerson);

      if (safePerson.applicant_number) {
        await fetchDocumentStatus(safePerson.applicant_number);
      }
    } catch (error) {
      console.error("❌ Failed to fetch person data:", error?.response?.data || error.message);
    }
  };

  const fetchDocumentStatus = async (applicant_number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/document_status/${applicant_number}`);
      setDocumentStatus(response.data.document_status);
      setPerson((prev) => ({
        ...prev,
        evaluator: response.data.evaluator || null
      }));
    } catch (err) {
      console.error("Error fetching document status:", err);
    }
  };

  useEffect(() => {
    if (person.applicant_number) {
      fetchDocumentStatus(person.applicant_number); // <-- pass the param
    }
  }, [person.applicant_number]);

  const handleApplyingAsChange = async (event) => {
    const newValue = event.target.value;
    if (!newValue || newValue === person.applyingAs) return;

    const personId = selectedPerson?.person_id || person?.person_id;
    if (!personId) {
      showSnackbar("Please select an applicant first.", "warning");
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/person/${personId}`,
        withAuditActor({ applyingAs: newValue }),
        { headers: getAuditHeaders({ "x-audit-change-section": "personal_information" }) }
      );

      setPerson((prev) => ({ ...prev, applyingAs: newValue }));

      // ✅ keep selectedPerson in sync so the requirements-filter effect re-runs
      setSelectedPerson((prev) =>
        prev ? { ...prev, applyingAs: newValue } : prev
      );

      showSnackbar("✅ Applying As updated successfully.", "success");
    } catch (err) {
      console.error("Error updating applyingAs:", err);
      showSnackbar("❌ Failed to update Applying As.", "error");
    }
  };

  const effectiveApplyingAs = selectedPerson?.applyingAs ?? person?.applyingAs;

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/requirements`)
      .then((res) => {
        const allRequirements = res.data;
        const filtered = allRequirements.filter(
          (req) => Number(req.applicant_type) === Number(effectiveApplyingAs) || Number(req.applicant_type) === 0
        );
        setRequirements(filtered);
      })
      .catch((err) => console.error("Error loading requirements:", err));
  }, [effectiveApplyingAs]);

  useEffect(() => {
    if (selectedPerson?.person_id) {
      fetchPersonData(selectedPerson.person_id);
    }
  }, [selectedPerson]);


  useEffect(() => {
    // No search text: keep explicit selection if present
    if (!searchQuery.trim()) {
      if (!explicitSelection) {
        setSelectedPerson(null);
        setUploads([]);
        setSelectedFiles({});
        setPerson({
          profile_img: "",
          generalAverage1: "",
          strand: "",
          program: "",
          height: "",
          applyingAs: "",
          document_status: "",
          last_name: "",
          first_name: "",
          middle_name: "",
          extension: "",
        });
      }
      return;
    }

    // User started typing -> manual search takes over
    if (explicitSelection) setExplicitSelection(false);

    const match = persons.find((p) =>
      `${p.first_name} ${p.middle_name} ${p.last_name} ${p.emailAddress} ${p.applicant_number || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );

    if (match) {
      setSelectedPerson(match);
      fetchUploadsByApplicantNumber(match.applicant_number);
    } else {
      setSelectedPerson(null);
      setUploads([]);
      setPerson({
        profile_img: "",
        generalAverage1: "",
        strand: "",
        program: "",
        height: "",
        applyingAs: "",
        document_status: "",
        last_name: "",
        first_name: "",
        middle_name: "",
        extension: "",
      });
    }
  }, [searchQuery, persons, explicitSelection]);


  const fetchPersons = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/upload_documents`);
      setPersons(res.data);
    } catch (err) {
      console.error('Error fetching persons:', err);
    }
  };

  const handleStatusChange = async (uploadId, remarkValue) => {
    const uploaded = uploads.find((item) => item.upload_id === uploadId);
    setTargetDoc({
      upload_id: uploadId,
      label: uploaded?.description || "Document",
      currentStatus: uploaded?.status || 0,
      nextStatus: remarkValue,
    });
    setConfirmAction("status");
    setConfirmOpen(true);
  };

  const performStatusChange = async (uploadId, remarkValue) => {

    try {
      await axios.put(`${API_BASE_URL}/api/uploads/status/${uploadId}`, {
        ...withAuditActor({
          status: remarkValue,
          user_id: userID,
        }),
      });

      setUploads((prev) =>
        prev.map((u) =>
          u.upload_id === uploadId
            ? { ...u, status: parseInt(remarkValue, 10) }
            : u
        )
      );

      if (selectedPerson?.applicant_number) {
        await fetchUploadsByApplicantNumber(selectedPerson.applicant_number);
      }
    } catch (err) {
      console.error("Error updating Status:", err);
    }
  };

  const handleDocumentStatus = async (event) => {
    const newStatus = event.target.value;
    if (!newStatus || newStatus === documentStatus) return;

    setTargetDoc({
      label: "Overall Document Status",
      currentStatus: documentStatus || "On process",
      nextStatus: newStatus,
    });
    setConfirmAction("documentStatus");
    setConfirmOpen(true);
  };

  const performDocumentStatusChange = async (newStatus) => {

    const applicantNumber =
      person?.applicant_number || selectedPerson?.applicant_number || "";

    if (!applicantNumber) {
      showSnackbar("Please select an applicant before updating document status.", "warning");
      return;
    }

    if (uploads.length === 0) {
      showSnackbar(
        "Cannot update document status yet. This applicant has no uploaded requirements to update.",
        "warning"
      );
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/document_status/${applicantNumber}`,
        withAuditActor({
          document_status: newStatus,
          user_id: localStorage.getItem("person_id"),
        }),
        { headers: getAuditHeaders() }
      );

      setDocumentStatus(newStatus);

      await fetchDocumentStatus(applicantNumber);

      await fetchUploadsByApplicantNumber(applicantNumber);

      // ✅ BUILD FULL NAME
      const fullName = `${(person.last_name || "").toUpperCase()}, ${(person.first_name || "").toUpperCase()} ${(person.middle_name || "").toUpperCase()} ${(person.extension || "").toUpperCase()}`;

      // ✅ SNACKBAR SUCCESS MESSAGE
      showSnackbar(
        `✅ Status updated to "${newStatus}" for Applicant [${applicantNumber}] ${fullName}`,
        "success"
      );

    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to update document status.";

      console.error("Error updating document status:", {
        status: err?.response?.status,
        data: err?.response?.data,
        applicantNumber,
        error: err,
      });
      showSnackbar(`❌ ${message}`, "error");
    }
  };

  const handleUploadSubmit = async () => {
    if (!canCreate) {
      showSnackbar("You do not have permission to upload documents.", "warning");
      return;
    }

    if (!selectedFiles.requirements_id || !selectedPerson?.person_id) {
      alert("Please select a document type.");
      return;
    }

    // If remarks is chosen but no file selected
    if (selectedFiles.remarks && !selectedFiles.file) {
      alert("Please select a file for the chosen remarks.");
      return;
    }

    try {
      const formData = new FormData();
      if (selectedFiles.file) formData.append("file", selectedFiles.file);
      formData.append("requirements_id", selectedFiles.requirements_id);
      formData.append("person_id", selectedPerson.person_id);
      formData.append("remarks", selectedFiles.remarks || "");

      await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-person-id": localStorage.getItem("person_id"), // ✅ now inside headers
          ...getAuditHeaders(),
        },
      });


      showSnackbar("✅ Upload successful!", "success");

      setSelectedFiles({});
      if (selectedPerson?.applicant_number) {
        fetchUploadsByApplicantNumber(selectedPerson.applicant_number);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      showSnackbar("❌ Upload failed.", "error");

    }
  };

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoSnackbar, setPhotoSnackbar] = useState({ open: false, message: "", severity: "success" });

  const handlePhotoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    const maxSize = 2 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      showSnackbar("Invalid file type. Please select a JPEG or PNG file.", "error");
      return;
    }
    if (file.size > maxSize) {
      showSnackbar("File is too large. Maximum allowed size is 2MB.", "error");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) {
      showSnackbar("Please select a file first.", "warning");
      return;
    }

    const targetPersonId = selectedPerson?.person_id || person?.person_id;
    if (!targetPersonId) {
      showSnackbar("No applicant selected.", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("profile_picture", photoFile);
    formData.append("person_id", targetPersonId);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/upload-profile-picture`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const fileName = response.data.filename || response.data.profile_img;
      setPerson((prev) => ({ ...prev, profile_img: fileName }));
      showSnackbar("✅ Photo uploaded successfully!", "success");
      setPhotoModalOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (error) {
      console.error("Photo upload failed:", error);
      showSnackbar("❌ Photo upload failed. Please try again.", "error");
    }
  };

  const handleDeleteExistingPhoto = async () => {
    const targetPersonId = selectedPerson?.person_id || person?.person_id;
    if (!targetPersonId) return;

    try {
      await axios.put(`${API_BASE_URL}/api/person/${targetPersonId}`, {
        profile_img: "",
      });
      setPerson((prev) => ({ ...prev, profile_img: "" }));
      setPhotoPreview(null);
      setPhotoFile(null);
      showSnackbar("✅ Photo removed successfully.", "success");
    } catch (err) {
      console.error("Failed to remove photo:", err);
      showSnackbar("❌ Failed to remove photo.", "error");
    }
  };

  const handleDelete = async (uploadId) => {

    try {
      await axios.delete(`${API_BASE_URL}/api/admin/uploads/${uploadId}`, {
        headers: {
          "x-person-id": localStorage.getItem("person_id"),
          ...getAuditHeaders(),
        },
        withCredentials: true,
      });

      if (selectedPerson?.applicant_number) {
        fetchUploadsByApplicantNumber(selectedPerson.applicant_number);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };


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

  const renderRow = (doc) => {
    const uploaded = uploads.find((u) => u.description === doc.label);
    const uploadId = uploaded?.upload_id;

    const buttonStyle = {
      minWidth: 120,
      height: 40,
      fontWeight: 'bold',
      fontSize: '14px',
      textTransform: 'none',
    };






    return (
      <TableRow key={doc.key}>
        <TableCell sx={{ fontWeight: 'bold', width: '20%', border: `1px solid ${borderColor}` }}>

          {doc.label}
          {Number(doc.is_optional) === 1 && (
            <span style={{ marginLeft: 2 }}>
              (Optional)
            </span>
          )}
        </TableCell>
        <TableCell sx={{ width: '20%', border: `1px solid ${borderColor}` }}>
          {uploadId && editingRemarkId === uploadId ? (
            // 🔥 TEXTFIELD ONLY
            <TextField
              size="small"
              fullWidth
              autoFocus
              placeholder="Enter remarks"
              value={remarksMap[uploadId] ?? uploaded?.remarks ?? ""}
              onChange={(e) =>
                setRemarksMap((prev) => ({ ...prev, [uploadId]: e.target.value }))
              }
              onBlur={async () => {
                const finalRemark = (remarksMap[uploadId] || "").trim();

                await axios.put(`${API_BASE_URL}/api/uploads/remarks/${uploadId}`, {
                  remarks: finalRemark,
                  user_id: userID,
                });

                if (selectedPerson?.applicant_number) {
                  await fetchUploadsByApplicantNumber(selectedPerson.applicant_number);
                }

                setEditingRemarkId(null);
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const finalRemark = (remarksMap[uploadId] || "").trim();

                  await axios.put(`${API_BASE_URL}/api/uploads/remarks/${uploadId}`, {
                    remarks: finalRemark,
                    user_id: userID,
                  });

                  if (selectedPerson?.applicant_number) {
                    await fetchUploadsByApplicantNumber(selectedPerson.applicant_number);
                  }

                  setEditingRemarkId(null);
                }
              }}
            />
          ) : (
            // 📌 DISPLAY MODE with GRAY BORDER (click to edit)
            <Box
              onClick={() => {
                if (!uploadId) return;
                setEditingRemarkId(uploadId);
                setRemarksMap((prev) => ({
                  ...prev,
                  [uploadId]: uploaded?.remarks ?? "",
                }));
              }}
              sx={{
                cursor: uploadId ? "pointer" : "default",
                fontStyle: uploaded?.remarks ? "normal" : "italic",
                color: uploaded?.remarks ? "inherit" : "#888",
                minHeight: "40px",
                display: "flex",
                alignItems: "center",
                px: 1,

                // ⭐ Added border here
                border: "1px solid #bdbdbd",
                borderRadius: "4px",
                backgroundColor: "#fafafa",
              }}
            >
              {uploaded?.remarks || "Click to add remarks"}
            </Box>
          )}
        </TableCell>





        <TableCell align="center" sx={{ width: '15%', border: `1px solid ${borderColor}` }}>
          {uploaded ? (
            uploaded.status === 1 ? (
              <Box
                sx={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  borderRadius: 1,
                  width: 140,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <Typography sx={{ fontWeight: 'bold' }}>Verified</Typography>
              </Box>
            ) : uploaded.status === 2 ? (
              <Box
                sx={{
                  backgroundColor: '#F44336',
                  color: 'white',
                  borderRadius: 1,
                  width: 140,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <Typography sx={{ fontWeight: 'bold' }}>Rejected</Typography>
              </Box>
            ) : (
              <Box display="flex" justifyContent="center" gap={1}>
                <Button
                  variant="contained"
                  onClick={() => handleStatusChange(uploaded.upload_id, '1')}
                  sx={{ ...buttonStyle, backgroundColor: 'green', color: 'white' }}
                >
                  Verified
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleStatusChange(uploaded.upload_id, '2')}
                  sx={{ ...buttonStyle, backgroundColor: 'red', color: 'white' }}
                >
                  Rejected
                </Button>
              </Box>
            )
          ) : null}
        </TableCell>

        <TableCell style={{ border: `1px solid ${borderColor}` }}>
          {uploaded?.created_at &&
            new Date(uploaded.created_at).toLocaleString('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Manila',
            })}
        </TableCell>

        <TableCell style={{ border: `1px solid ${borderColor}` }}>
          {(selectedPerson?.applicant_number || person?.applicant_number)
            ? `[${selectedPerson?.applicant_number || person?.applicant_number}] ${(selectedPerson?.last_name || person?.last_name || "").toUpperCase()}, ${(selectedPerson?.first_name || person?.first_name || "").toUpperCase()} ${(selectedPerson?.middle_name || person?.middle_name || "").toUpperCase()} ${(selectedPerson?.extension || person?.extension || "").toUpperCase()}`
            : ""}
        </TableCell>


        <TableCell style={{ border: `1px solid ${borderColor}` }}>
          <Box display="flex" justifyContent="center" gap={1}>
            {uploaded ? (
              <>
                {/* <Button
                  variant="contained"
                  size="small"
                  sx={{
                    backgroundColor: 'green',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#006400'
                    }
                  }}
                  onClick={() => {
                    setEditingRemarkId(uploaded.upload_id);
                    setRemarksMap((prev) => ({
                      ...prev,
                      [uploaded.upload_id]: uploaded.remarks || "",
                    }));
                  }}
                >
                  Edit
                </Button> */}

                <Button
                  variant="contained"
                  sx={{ backgroundColor: '#1976d2', color: 'white' }}
                  href={`${API_BASE_URL}/ApplicantOnlineDocuments/${uploaded.file_path}`}
                  target="_blank"
                  startIcon={<VisibilityIcon />}
                >
                  Preview
                </Button>

              </>
            ) : null}
          </Box>
        </TableCell>

      </TableRow>

    );
  };



  // Put this at the very bottom before the return 
  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return (
      <Unauthorized />
    );
  }



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
        <Typography variant="h4"
          sx={{
            fontWeight: 'bold',
            color: titleColor,
            fontSize: '36px',
          }}
        >
          APPLICANT ONLINE REQUIREMENTS
        </Typography>


        <TextField
          variant="outlined"
          placeholder="Search Applicant Name / Email / Applicant ID"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            width: 450,
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

      <AdmissionProcessTabs />

      <br />
      <br />


      {/* Applicant ID and Name */}
      <TableContainer component={Paper} sx={{ width: '100%', border: `1px solid ${borderColor}` }}>
        <Table>
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2", }}>
            <TableRow>
              {/* Left cell: Applicant ID */}
              <TableCell sx={{ color: 'white', fontSize: '20px', fontFamily: "Poppins, sans-serif", }}>
                Applicant ID:&nbsp;
                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: "normal", textDecoration: "underline" }}>
                  {selectedPerson?.applicant_number || person?.applicant_number || "N/A"}
                </span>
              </TableCell>

              {/* Right cell: Applicant Name, right-aligned */}
              <TableCell
                align="right"
                sx={{ color: 'white', fontSize: '20px', fontFamily: "Poppins, sans-serif", }}
              >
                Applicant Name:&nbsp;
                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: "normal", textDecoration: "underline" }}>
                  {(selectedPerson?.last_name || person?.last_name || "").toUpperCase()},
                  &nbsp;{(selectedPerson?.first_name || person?.first_name || "").toUpperCase()}{" "}
                  {(selectedPerson?.middle_name || person?.middle_name || "").toUpperCase()}{" "}
                  {(selectedPerson?.extension || person?.extension || "").toUpperCase()}
                </span>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>


      <TableContainer component={Paper} sx={{ width: '100%', border: `1px solid ${borderColor}` }}>
        {/* SHS GWA and Height row below Applicant Name */}
        <Box sx={{ px: 2, mb: 2, mt: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1, }}>
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "Poppins, sans-serif",
                minWidth: "100px",

                mr: 1,
              }}
            >
              Program Applied:
            </Typography>
            <TextField
              size="small"
              name="program"
              value={curriculumOptions.length > 0
                ? curriculumOptions.find(
                  (item) =>
                    item?.curriculum_id?.toString() ===
                    (person?.program ?? "").toString()
                )?.program_description || (person?.program ?? "")
                : "Loading..."}
              sx={{ width: "500px" }}
              InputProps={{
                sx: {
                  height: 35, // control outer height
                },
              }}
              inputProps={{
                style: {
                  padding: "4px 8px", // control inner padding
                  fontSize: "12px",
                },
              }}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1, }}>
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "Poppins, sans-serif",
                minWidth: "100px",

                mr: 1,
              }}
            >
              Strand:
            </Typography>
            <TextField
              size="small"
              name="strand"
              value={person.strand || ""}
              sx={{ width: "350px" }}
              InputProps={{
                sx: {
                  height: 35, // control outer height
                },
              }}
              inputProps={{
                style: {
                  padding: "4px 8px", // control inner padding
                  fontSize: "12px",
                },
              }}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1, }}>
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "Poppins, sans-serif",
                minWidth: "100px",

                mr: 1,
              }}
            >
              SHS Gwa:
            </Typography>
            <TextField
              size="small"
              name="generalAverage1"
              value={person.generalAverage1 || ""}
              sx={{ width: "250px" }}
              InputProps={{
                sx: {
                  height: 35, // control outer height
                },
              }}
              inputProps={{
                style: {
                  padding: "4px 8px", // control inner padding
                  fontSize: "12px",
                },
              }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "Poppins, sans-serif",
                minWidth: "100px",
                mr: 1,
              }}
            >
              Height:
            </Typography>
            <TextField
              size="small"
              name="height"
              value={person.height || ""}
              sx={{ width: "100px" }}
              InputProps={{
                sx: {
                  height: 35,
                },
              }}
              inputProps={{
                style: {
                  padding: "4px 8px",
                  fontSize: "12px",
                },
              }}
            />
            <div style={{ fontSize: "12px", marginLeft: "10px" }}>cm.</div>
          </Box>
        </Box>


        <br />
        <br />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            px: 2,
          }}
        >
          {/* Left side: Applying As and Strand */}
          <Box>
            {/* Applying As */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontFamily: "Poppins, sans-serif",
                  minWidth: "120px",

                  mr: 4.8,
                }}
              >
                Applying As:
              </Typography>
              <TextField
                select
                size="small"
                name="applyingAs"
                value={person.applyingAs || ""}
                onChange={handleApplyingAsChange}
                placeholder="Select applyingAs"
                sx={{ width: "400px" }}
                InputProps={{ sx: { height: 35 } }}
                inputProps={{ style: { padding: "4px 8px", fontSize: "12px" } }}
              >
                <MenuItem value="">
                  <em>Select Applying</em>
                </MenuItem>
                <MenuItem value="1">
                  Senior High School Graduate
                </MenuItem>
                <MenuItem value="2">
                  Senior High School Graduating Student
                </MenuItem>
                <MenuItem value="3">
                  ALS (Alternative Learning System) Passer
                </MenuItem>
                <MenuItem value="4">
                  Transferee from other University/College
                </MenuItem>
                <MenuItem value="5">
                  Cross Enrolee Student
                </MenuItem>
                <MenuItem value="6">
                  Foreign Applicant/Student
                </MenuItem>
                <MenuItem value="7">
                  Baccalaureate Graduate
                </MenuItem>
                <MenuItem value="8">
                  Master Degree Graduate
                </MenuItem>
              </TextField>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontFamily: "Poppins, sans-serif",
                  minWidth: "140px",
                  mr: 2.3,
                }}
              >
                Document Status:
              </Typography>
              <TextField
                select
                size="small"
                name="document_status"
                value={documentStatus}
                onChange={handleDocumentStatus}
                sx={{ width: "300px", mr: 2 }}
                InputProps={{ sx: { height: 35 } }}
                inputProps={{ style: { padding: "4px 8px", fontSize: "12px" } }}
              >
                <MenuItem value="">
                  <em>Select Document Status</em>
                </MenuItem>
                <MenuItem value="On Process">On Process</MenuItem>
                <MenuItem value="Documents Verified & ECAT">Documents Verified & ECAT</MenuItem>
                <MenuItem value="Disapproved / Program Closed">Disapproved / Program Closed</MenuItem>

              </TextField>

              {person?.evaluator &&
                (person.evaluator.evaluator_email ||
                  person.evaluator.evaluator_lname ||
                  person.evaluator.evaluator_fname ||
                  person.evaluator.evaluator_mname) && (
                  <Typography variant="caption" sx={{ marginLeft: 1 }}>
                    Status Changed By:{" "}
                    {person.evaluator.evaluator_email
                      ? `${person.evaluator.evaluator_email.replace(/@gmail\.com$/i, "")} `
                      : ""}
                    ({person.evaluator.evaluator_lname || ""},{" "}
                    {person.evaluator.evaluator_fname || ""}{" "}
                    {person.evaluator.evaluator_mname || ""})
                    {person.evaluator.created_at && (
                      <>
                        <br />
                        Updated At:{" "}
                        {new Date(person.evaluator.created_at).toLocaleString()}
                      </>
                    )}
                  </Typography>
                )}

            </Box>



            {/* Document Type, Remarks, and Document File */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, mb: 2 }}>

              {/* Document Type */}
              {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, }}>
                  <Typography sx={{ fontSize: "14px", fontFamily: "Poppins, sans-serif", width: "90px" }}>
                    Document Type:
                  </Typography>
                  <TextField
                    select
                    size="small"
                    placeholder="Select Documents"
                    value={selectedFiles.requirements_id || ''}
                    onChange={(e) =>
                      setSelectedFiles(prev => ({
                        ...prev,
                        requirements_id: e.target.value,
                      }))
                    }
                    sx={{ width: 200 }} // match width
                    InputProps={{ sx: { height: 38 } }} // match height
                    inputProps={{ style: { padding: "4px 8px", fontSize: "12px" } }}
                  >
                    <MenuItem value="">
                      <em>Select Documents</em>
                    </MenuItem>
                    <MenuItem value={1}>PSA Birth Certificate</MenuItem>
                    <MenuItem value={2}>Form 138 (With at least 3rd Quarter posting / No failing grade)</MenuItem>
                    <MenuItem value={3}>Certificate of Good Moral Character</MenuItem>
                    <MenuItem value={4}>Certificate Belonging to Graduating Class</MenuItem>
                  </TextField>
                </Box> */}


              {/* ---------------------------------------------------------------------- */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: "14px", fontFamily: "Poppins, sans-serif", width: "90px" }}>
                  Document Type:
                </Typography>
                <TextField
                  disabled
                  select
                  size="small"
                  placeholder="Select Documents"
                  value={selectedFiles.requirements_id || ''}
                  onChange={(e) =>
                    setSelectedFiles(prev => ({
                      ...prev,
                      requirements_id: e.target.value,
                    }))
                  }
                  sx={{ width: 200 }}
                  InputProps={{ sx: { height: 38 } }}
                  inputProps={{ style: { padding: "4px 8px", fontSize: "12px" } }}
                >
                  <MenuItem value="">
                    <em>Select Documents</em>
                  </MenuItem>
                  {/* ✅ Dynamically map requirements from DB */}
                  {requirements.map((req) => (
                    <MenuItem key={req.id} value={req.id}>
                      {req.description}
                      {req.is_optional === 1 && (
                        <span style={{ color: "#999", fontStyle: "italic", marginLeft: 6 }}>
                          (Optional)
                        </span>
                      )}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              {/* ---------------------------------------------------------------------- */}
              {/*
                Remarks
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: "14px", fontFamily: "Poppins, sans-serif", width: "80px" }}>
                    Remarks
                  </Typography>
                  <TextField
                    select
                    size="small"
                    placeholder="Select Remarks"
                    value={selectedFiles.remarks || ''}
                    onChange={(e) =>
                      setSelectedFiles(prev => ({
                        ...prev,
                        remarks: e.target.value,
                      }))
                    }
                    sx={{ width: 250 }}
                    InputProps={{ sx: { height: 38 } }}
                    inputProps={{ style: { padding: "4px 8px", fontSize: "12px" } }}
                  >
                    <MenuItem value="">
                      <em>Select Remarks</em>
                    </MenuItem>
                    {remarksOptions.map((option, index) => (
                      <MenuItem key={index} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
*/}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginLeft: "-25px" }}>
                <Typography
                  sx={{
                    fontSize: "14px",
                    fontFamily: "Poppins, sans-serif",
                    width: "100px",
                    textAlign: "center"
                  }}
                >
                  Document File:
                </Typography>

                {/* 📂 Gray Box Always Visible */}
                <Box
                  sx={{
                    backgroundColor: '#e0e0e0',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 250,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={selectedFiles.file ? selectedFiles.file.name : "No file selected"}
                >
                  {selectedFiles.file ? selectedFiles.file.name : "No file selected"}
                </Box>

                {/* 📁 Browse Button */}
                <Button
                  disabled
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => document.getElementById("fileInput").click()}
                  sx={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    textTransform: 'none',
                    width: 250,
                    height: 38,
                    fontSize: "15px",
                    fontWeight: 'bold',
                    justifyContent: "center",
                    '&:hover': { backgroundColor: '#1565c0' }
                  }}
                >
                  Browse File
                </Button>

                <input
                  id="fileInput"
                  type="file"
                  hidden
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) =>
                    setSelectedFiles(prev => ({
                      ...prev,
                      file: e.target.files[0],
                    }))
                  }
                />

                {/* 🟢 Submit Button */}
                <Button
                  disabled
                  variant="contained"
                  color="success"
                  sx={{
                    textTransform: "none",
                    fontWeight: "bold",
                    height: 38,
                    width: 250
                  }}
                  onClick={() => handleConfirmUpload({ label: "New Document" })}

                >
                  Submit Documents
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Right side: ID Photo */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "-360px",
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: "2.10in",
                height: "2.10in",
                border: "1px solid #ccc",
                overflow: "hidden",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f5f5f5",
              }}
            >
              {person.profile_img ? (
                <img
                  src={`${API_BASE_URL}/uploads/Applicant1by1/${person.profile_img}`}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Typography fontSize={11} color="textSecondary" textAlign="center" px={1}>
                  No Photo Uploaded
                </Typography>
              )}
            </Box>

            <Button
              variant="contained"
              size="small"
              startIcon={<CloudUploadIcon />}
              onClick={() => setPhotoModalOpen(true)}
              disabled={!selectedPerson?.person_id && !person?.person_id}
              sx={{
                backgroundColor: mainButtonColor,
                color: "#fff",
                textTransform: "none",
                fontWeight: "bold",
                width: "2.10in",
                "&:hover": { backgroundColor: "#000" },
              }}
            >
              Upload Photo
            </Button>
          </Box>
        </Box>
      </TableContainer>




      <>
        <TableContainer component={Paper} sx={{ width: '100%', border: `1px solid ${borderColor}` }}>
          <Table>
            <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2", }}>
              <TableRow>
                <TableCell sx={{ color: 'white', textAlign: "Center", border: `1px solid ${borderColor}` }}>Document Type</TableCell>
                <TableCell sx={{ color: 'white', textAlign: "Center", border: `1px solid ${borderColor}` }}>Remarks</TableCell>
                <TableCell sx={{ color: 'white', textAlign: "Center", border: `1px solid ${borderColor}` }}>Status</TableCell>
                <TableCell sx={{ color: 'white', textAlign: "Center", border: `1px solid ${borderColor}` }}>Date and Time Submitted</TableCell>
                <TableCell sx={{ color: 'white', textAlign: "Center", border: `1px solid ${borderColor}` }}>User</TableCell>
                <TableCell sx={{ color: 'white', textAlign: "Center", border: `1px solid ${borderColor}` }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                border: `1px solid ${borderColor}`,
                "& .MuiTableRow-root:nth-of-type(odd)": {
                  backgroundColor: "#ffffff",
                },
                "& .MuiTableRow-root:nth-of-type(even)": {
                  backgroundColor: "lightgray",
                },
              }}
            >
              {requirements.map((doc) =>
                renderRow({
                  label: doc.description,
                  key: doc.short_label || doc.description.replace(/\s+/g, ""),
                  id: doc.id,
                  is_optional: doc.is_optional
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
        {/* Confirmation Dialog */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle
            sx={{
              background: settings?.header_color || "#9E0000",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1.2rem",
              py: 2,
            }}
          >
            {confirmAction === "upload" ? "📤 Confirm Upload" : "🗑️ Confirm Deletion"}
          </DialogTitle>

          <DialogContent sx={{ maxHeight: 400, overflowY: "auto", p: 3, mt: 2 }}>
            <Box
              sx={{
                backgroundColor: "#fdfdfd",
                borderRadius: "8px",
                px: 2,
                py: 2,
                border: "1px solid #ddd",
                fontSize: "0.95rem",
                lineHeight: 1.8,
              }}
            >
              {confirmAction === "upload" ? (
                <Typography>
                  Are you sure you want to upload{" "}
                  <strong>{targetDoc?.label}</strong>?<br />
                  Added by:{" "}
                  <strong>{localStorage.getItem("username")}</strong>
                </Typography>
              ) : (
                <Typography>
                  Are you sure you want to delete{" "}
                  <strong>
                    {targetDoc?.label || targetDoc?.short_label || targetDoc?.file_path}
                  </strong>
                  ?<br />
                  Deleted by:{" "}
                  <strong>{localStorage.getItem("username")}</strong>
                </Typography>
              )}
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              color="error"
              variant="outlined"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmAction}
              sx={{
                backgroundColor: settings?.header_color || "#9E0000",
                "&:hover": {
                  backgroundColor: settings?.header_color
                    ? `${settings.header_color}cc`
                    : "#7a0000",
                },
              }}
            >
              Yes, Confirm
            </Button>
          </DialogActions>
        </Dialog>
        {/* Photo Upload Modal */}
        {/* Photo Upload Modal - matches AdminDashboard1 style */}
        <Modal
          open={photoModalOpen}
          onClose={() => {
            setPhotoModalOpen(false);
            setPhotoFile(null);
            setPhotoPreview(null);
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: 600,
                bgcolor: "background.paper",
                borderRadius: 3,
                boxShadow: 24,
                p: 4,
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              {/* Close (X) Button in top-right */}
              <IconButton
                aria-label="close"
                onClick={() => {
                  setPhotoModalOpen(false);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                }}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  color: "#fff",
                  backgroundColor: settings?.header_color || "#1976d2",
                  border: `1px solid ${borderColor}`,
                  "&:hover": { bgcolor: "black" },
                }}
              >
                <CloseIcon />
              </IconButton>

              {/* Header */}
              <Box
                sx={{
                  backgroundColor: settings?.header_color || "#1976d2",
                  border: `1px solid ${borderColor}`,
                  color: "white",
                  py: 2,
                  px: 3,
                  borderRadius: 2,
                  textAlign: "center",
                  mb: 3,
                }}
              >
                <Typography variant="h6" fontWeight="bold">
                  Upload Student 2×2 Photo
                </Typography>
              </Box>

              {/* Preview Image */}
              {(photoPreview || person.profile_img) && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    my: 2,
                    position: "relative",
                  }}
                >
                  <Box
                    component="img"
                    src={
                      photoPreview
                        ? photoPreview
                        : `${API_BASE_URL}/uploads/Applicant1by1/${person.profile_img}`
                    }
                    alt="Preview"
                    sx={{
                      width: "192px",
                      height: "192px",
                      objectFit: "cover",
                      border: `1px solid ${borderColor}`,
                      borderRadius: 2,
                    }}
                  />

                  {/* ❌ REMOVE BUTTON */}
                  <Button
                    size="small"
                    onClick={() => {
                      if (photoPreview) {
                        // Clear newly selected file only
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      } else {
                        // Delete existing saved photo from DB
                        handleDeleteExistingPhoto();
                      }
                    }}
                    sx={{
                      position: "absolute",
                      top: -8,
                      right: "calc(50% - 96px)",
                      minWidth: 0,
                      width: 28,
                      height: 28,
                      fontSize: "18px",
                      p: 0,
                      color: "#fff",
                      bgcolor: "#d32f2f",
                      borderRadius: "50%",
                      "&:hover": { bgcolor: "#b71c1c" },
                    }}
                  >
                    ×
                  </Button>
                </Box>
              )}

              {/* No photo placeholder */}
              {!photoPreview && !person.profile_img && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    my: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 192,
                      height: 192,
                      border: "2px dashed #ccc",
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    <Typography fontSize={12} color="textSecondary" textAlign="center" px={2}>
                      No photo yet
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Guidelines Section */}
              <Box
                sx={{
                  border: "2px dashed #ccc",
                  p: 2,
                  borderRadius: 2,
                  mb: 3,
                  backgroundColor: "#f9f9f9",
                }}
              >
                <Typography variant="body1" fontWeight="bold" mb={1}>
                  Guidelines:
                </Typography>
                <Box sx={{ ml: 2, fontSize: "15px" }}>
                  - Size: 2" x 2"<br />
                  - Color: Your photo must be in colored.<br />
                  - Background: White.<br />
                  - Head size and position: Look directly into the camera at a straight angle, face centered.<br />
                  - File types: JPEG, JPG, PNG<br />
                  - Attire must be formal.<br />
                  - Required File Size: 2mb
                </Box>

                <Typography variant="body1" fontWeight="bold" mt={2}>
                  How to Change the Photo?
                </Typography>
                <Box sx={{ ml: 2, fontSize: "15px" }}>
                  - Click the X Button<br />
                  - Choose a new file<br />
                  - Click the Upload button
                </Box>
              </Box>

              {/* File Input */}
              <Typography
                sx={{
                  fontSize: "18px",
                  color: mainButtonColor,
                  fontWeight: "bold",
                  mb: 1,
                }}
              >
                Select Your Image:
              </Typography>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onClick={(e) => (e.target.value = null)}
                onChange={handlePhotoFileChange}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginBottom: "16px",
                }}
              />

              {/* Upload Button */}
              <Button
                variant="contained"
                fullWidth
                disabled={!photoFile}
                onClick={handlePhotoUpload}
                sx={{
                  backgroundColor: settings?.header_color || "#1976d2",
                  border: `1px solid ${borderColor}`,
                  color: "white",
                  fontWeight: "bold",
                  "&:hover": { backgroundColor: "#000000" },
                }}
              >
                Upload
              </Button>
            </Box>
          </Box>
        </Modal>
      </>
    </Box >
  );
};

export default StudentRequirements;

import {
  Box,
  Button,
  Typography,
  TextField,
  Snackbar,
  Alert,
  Avatar,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Checkbox,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import DateField from "../components/DateField";
import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import EaristLogo from "../assets/EaristLogo.png";
import { InsertPageBreak, Search } from "@mui/icons-material";
import { useLocation } from "react-router-dom";
import axios from "axios";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import RegistrarEnrollmentTabs from "../components/RegistrarEnrollmentTabs";
import SearchIcon from "@mui/icons-material/Search";
import { FcPrint } from "react-icons/fc";
import API_BASE_URL from "../apiConfig";
import { getFlatAuditHeaders } from "../utils/auditEvents";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RuleIcon from "@mui/icons-material/Rule";
import BagongPilipinasLogo from "../assets/bagongpilipinas.png";
import Ukas from "../assets/ukas.png";
import Act from "../assets/act.png";
import Iaf from "../assets/iaf.png";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import PhotoCaptureDialog from "../components/PhotoCaptureDialog";

const cleanSuggestionValue = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return ["null", "undefined"].includes(text.toLowerCase()) ? "" : text;
};

const formatSuggestionName = (student) =>
  [
    cleanSuggestionValue(student?.first_name),
    cleanSuggestionValue(student?.middle_name),
    cleanSuggestionValue(student?.last_name),
  ].filter(Boolean).join(" ");


const TOR_EDIT_OPTIONS = [
  {
    key: "capturePhoto",
    label: "Capture Photo",
    description: "Take a photo and save it as the student's profile image",
    icon: <CameraAltIcon sx={{ fontSize: 32 }} />,
    color: "#0277bd",
    bg: "#e1f5fe",
  },
  {
    key: "remarks",
    label: "Edit Remarks",
    description: "Note shown in the REMARKS field on every page",
    icon: <EditNoteIcon sx={{ fontSize: 32 }} />,
    color: "#1976d2",
    bg: "#e3f2fd",
  },
  {
    key: "admissionCredentials",
    label: "Edit Admission Credentials",
    description: "Text shown in the ADMISSION CREDENTIALS field",
    icon: <EditNoteIcon sx={{ fontSize: 32 }} />,
    color: "#c2410c",
    bg: "#fff3e0",
  },
  {
    key: "footerNotes",
    label: "Edit Credits / Institution Note",
    description: "Credits line and institution note in the footer",
    icon: <EditNoteIcon sx={{ fontSize: 32 }} />,
    color: "#6a1b9a",
    bg: "#f3e5f5",
  },
  {
    key: "gradingSystem",
    label: "Edit Grading System",
    description: "Grade, score range, and description rows",
    icon: <RuleIcon sx={{ fontSize: 32 }} />,
    color: "#2e7d32",
    bg: "#e8f5e9",
  },
];

const TranscriptOfRecords = () => {
  const settings = useContext(SettingsContext);
  const colors = settings?.colors || {};
  const branding = settings?.branding || {};
  const assets = settings?.assets || {};
  const headerColor = colors.header || "#1976d2";

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff"); // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000"); // ✅ NEW

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (colors.title) setTitleColor(colors.title);
    if (colors.subtitle) setSubtitleColor(colors.subtitle);
    if (colors.border) setBorderColor(colors.border);
    if (colors.mainButton)
      setMainButtonColor(colors.mainButton);
    if (colors.subButton) setSubButtonColor(colors.subButton); // ✅ NEW
    if (colors.stepper) setStepperColor(colors.stepper); // ✅ NEW

    // 🏫 Logo
    if (assets.logoUrl) {
      setFetchedLogo(assets.logoUrl);
    } else {
      setFetchedLogo(EaristLogo);
    }

    // 🏷️ School Information
    if (branding.companyName) setCompanyName(branding.companyName);
    if (branding.shortTerm) setShortTerm(branding.shortTerm);
    setBranches(settings?.branches || []);
  }, [settings]);



  const [logoDataUris, setLogoDataUris] = useState({
    bagongPilipinas: null,
    school: null,
    act: null,
    ukas: null,
    iaf: null,
  });
  const toDataUri = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("Failed to convert logo to data URI:", url, err);
      return null;
    }
  };

  // Bagong Pilipinas logo — bundled asset, only needs to run once
  useEffect(() => {
    (async () => {
      const bp = await toDataUri(BagongPilipinasLogo);
      setLogoDataUris((prev) => ({ ...prev, bagongPilipinas: bp }));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [actUri, ukasUri, iafUri] = await Promise.all([
        toDataUri(Act),
        toDataUri(Ukas),
        toDataUri(Iaf),
      ]);
      setLogoDataUris((prev) => ({ ...prev, act: actUri, ukas: ukasUri, iaf: iafUri }));
    })();
  }, []);

  // School logo — re-run if the dynamic settings logo changes
  useEffect(() => {
    (async () => {
      const sl = await toDataUri(fetchedLogo || EaristLogo);
      setLogoDataUris((prev) => ({ ...prev, school: sl }));
    })();
  }, [fetchedLogo]);

  const [person, setPerson] = useState({
    profile_img: "",
    campus: "",
    academicProgram: "",
    classifiedAs: "",
    program: "",
    program2: "",
    program3: "",
    yearLevel: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    extension: "",
    nickname: "",
    height: "",
    weight: "",
    lrnNumber: "",
    gender: "",
    pwdType: "",
    pwdId: "",
    birthOfDate: "",
    age: "",
    birthPlace: "",
    languageDialectSpoken: "",
    citizenship: "",
    religion: "",
    civilStatus: "",
    tribeEthnicGroup: "",
    otherEthnicGroup: "",
    cellphoneNumber: "",
    emailAddress: "",
    telephoneNumber: "",
    facebookAccount: "",
    presentStreet: "",
    presentBarangay: "",
    presentZipCode: "",
    presentRegion: "",
    presentProvince: "",
    presentMunicipality: "",
    presentDswdHouseholdNumber: "",
    permanentStreet: "",
    permanentBarangay: "",
    permanentZipCode: "",
    permanentRegion: "",
    permanentProvince: "",
    permanentMunicipality: "",
    permanentDswdHouseholdNumber: "",
    father_deceased: "",
    father_family_name: "",
    father_given_name: "",
    father_middle_name: "",
    father_ext: "",
    father_contact: "",
    father_occupation: "",
    father_income: "",
    father_email: "",
    mother_deceased: "",
    mother_family_name: "",
    mother_given_name: "",
    mother_middle_name: "",
    mother_contact: "",
    mother_occupation: "",
    mother_income: "",
    guardian: "",
    guardian_family_name: "",
    guardian_given_name: "",
    guardian_middle_name: "",
    guardian_ext: "",
    guardian_nickname: "",
    guardian_address: "",
    guardian_contact: "",
    guardian_email: "",
    schoolLevel: "",
    schoolLastAttended: "",
    schoolAddress: "",
    courseProgram: "",
    honor: "",
    generalAverage: "",
    yearGraduated: "",
    schoolLevel1: "",
    schoolLastAttended1: "",
    schoolAddress1: "",
    courseProgram1: "",
    honor1: "",
    generalAverage1: "",
    yearGraduated1: "",
    strand: "",
  });

  const [campusAddress, setCampusAddress] = useState("");
  const [gradeConversion, setGradeConversions] = useState([]);

  // ---- TOR settings (remarks / admission credentials / footer notes) ----
  const DEFAULT_REMARKS = "COPY FOR EMPLOYMENT PURPOSES ONLY.";
  const DEFAULT_ADMISSION_CREDENTIALS =
    "CERT. OF GOOD MORAL CHARACTER / F138 / F137 / PSA BIRTH CERT.";
  const DEFAULT_CREDITS_NOTE =
    "CREDITS, One college units is at least (17) full hours of instruction in academic or professional subject within a semester.";
  const DEFAULT_INSTITUTION_NOTE =
    "is a State College; hence, a SPECIAL ORDER is not issued to its graduates. The issuance of the Official Transcript of Records and Diploma is a sufficient proof for Graduation.";

  const [remarks, setRemarks] = useState(DEFAULT_REMARKS);
  const [admissionCredentialsNote, setAdmissionCredentialsNote] = useState(DEFAULT_ADMISSION_CREDENTIALS);
  const [creditsNote, setCreditsNote] = useState(DEFAULT_CREDITS_NOTE);
  const [institutionNote, setInstitutionNote] = useState(DEFAULT_INSTITUTION_NOTE);
  const [institutionWebsite, setInstitutionWebsite] = useState("");

  const [remarksDialogOpen, setRemarksDialogOpen] = useState(false);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [admissionCredentialsDialogOpen, setAdmissionCredentialsDialogOpen] = useState(false);
  const [admissionCredentialsDraft, setAdmissionCredentialsDraft] = useState("");
  const [footerNotesDialogOpen, setFooterNotesDialogOpen] = useState(false);
  const [creditsNoteDraft, setCreditsNoteDraft] = useState("");
  const [institutionNoteDraft, setInstitutionNoteDraft] = useState("");

  const fetchTorSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tor-settings`);
      const data = res.data?.data;
      if (data) {
        setRemarks(data.remarks || DEFAULT_REMARKS);
        setAdmissionCredentialsNote(data.admission_credentials || DEFAULT_ADMISSION_CREDENTIALS);
        setCreditsNote(data.credits_note || DEFAULT_CREDITS_NOTE);
        setInstitutionNote(data.institution_note || DEFAULT_INSTITUTION_NOTE);
        setInstitutionWebsite(data.institution_website || "");
      }
    } catch (err) {
      console.error("Failed to fetch TOR settings:", err);
    }
  };

  useEffect(() => {
    fetchTorSettings();
  }, []);

  // Shared saver — always sends the full row so a save from one dialog
  // never blanks out the fields owned by the other two dialogs.
  const saveTorSettings = async (overrides) => {
    const payload = {
      remarks,
      admission_credentials: admissionCredentialsNote,
      credits_note: creditsNote,
      institution_note: institutionNote,
      institution_website: institutionWebsite,
      ...overrides,
    };
    await axios.put(`${API_BASE_URL}/api/tor-settings`, payload);
  };

  const openRemarksDialog = () => {
    setRemarksDraft(remarks);
    setRemarksDialogOpen(true);
  };
  const closeRemarksDialog = () => setRemarksDialogOpen(false);
  const handleSaveRemarks = async () => {
    const cleaned = remarksDraft.trim() || DEFAULT_REMARKS;
    try {
      await saveTorSettings({ remarks: cleaned });
      setRemarks(cleaned);
    } catch (err) {
      console.error("Failed to save remarks:", err);
      setSnackbarMessage("Failed to save remarks.");
      setOpenSnackbar(true);
      return;
    }
    setRemarksDialogOpen(false);
  };

  const openAdmissionCredentialsDialog = () => {
    setAdmissionCredentialsDraft(admissionCredentialsNote);
    setAdmissionCredentialsDialogOpen(true);
  };
  const closeAdmissionCredentialsDialog = () => setAdmissionCredentialsDialogOpen(false);
  const handleSaveAdmissionCredentials = async () => {
    const cleaned = admissionCredentialsDraft.trim() || DEFAULT_ADMISSION_CREDENTIALS;
    try {
      await saveTorSettings({ admission_credentials: cleaned });
      setAdmissionCredentialsNote(cleaned);
    } catch (err) {
      console.error("Failed to save admission credentials:", err);
      setSnackbarMessage("Failed to save admission credentials.");
      setOpenSnackbar(true);
      return;
    }
    setAdmissionCredentialsDialogOpen(false);
  };

  const openFooterNotesDialog = () => {
    setCreditsNoteDraft(creditsNote);
    setInstitutionNoteDraft(institutionNote);
    setFooterNotesDialogOpen(true);
  };
  const closeFooterNotesDialog = () => setFooterNotesDialogOpen(false);
  const handleSaveFooterNotes = async () => {
    const cleanedCredits = creditsNoteDraft.trim() || DEFAULT_CREDITS_NOTE;
    const cleanedInstitution = institutionNoteDraft.trim() || DEFAULT_INSTITUTION_NOTE;
    try {
      await saveTorSettings({
        credits_note: cleanedCredits,
        institution_note: cleanedInstitution,
      });
      setCreditsNote(cleanedCredits);
      setInstitutionNote(cleanedInstitution);
    } catch (err) {
      console.error("Failed to save footer notes:", err);
      setSnackbarMessage("Failed to save footer notes.");
      setOpenSnackbar(true);
      return;
    }
    setFooterNotesDialogOpen(false);
  };

  // ---- Grading system: toggle visibility of existing grade_conversion rows ----
  const [gradingSystemRows, setGradingSystemRows] = useState([]); // rows currently shown on the TOR
  const [gradingSystemDialogOpen, setGradingSystemDialogOpen] = useState(false);
  const [gradingSystemDraft, setGradingSystemDraft] = useState([]); // full list + checked state, dialog-only

  const fetchTorGradingSystem = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tor-grading-system`);
      setGradingSystemRows(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch TOR grading system:", err);
      setGradingSystemRows([]);
    }
  };

  useEffect(() => {
    fetchTorGradingSystem();
  }, []);

  const openGradingSystemDialog = () => {
    const shownIds = new Set(gradingSystemRows.map((r) => r.id));
    setGradingSystemDraft(
      gradeConversion.map((row) => ({ ...row, show_on_tor: shownIds.has(row.id) })),
    );
    setGradingSystemDialogOpen(true);
  };
  const closeGradingSystemDialog = () => setGradingSystemDialogOpen(false);

  const handleToggleGradingSystemRow = (id) => {
    setGradingSystemDraft((prev) =>
      prev.map((row) => (row.id === id ? { ...row, show_on_tor: !row.show_on_tor } : row)),
    );
  };

  const handleSaveGradingSystem = async () => {
    const shownIds = new Set(gradingSystemRows.map((r) => r.id));
    const changedRows = gradingSystemDraft.filter(
      (row) => Boolean(row.show_on_tor) !== shownIds.has(row.id),
    );

    if (changedRows.length === 0) {
      setGradingSystemDialogOpen(false);
      return;
    }

    try {
      await Promise.all(
        changedRows.map((row) =>
          axios.put(`${API_BASE_URL}/api/tor-grading-system/${row.id}/toggle`, {
            show_on_tor: row.show_on_tor,
          }),
        ),
      );
      await fetchTorGradingSystem();
    } catch (err) {
      console.error("Failed to save grading system:", err);
      setSnackbarMessage("Failed to save grading system changes.");
      setOpenSnackbar(true);
      return;
    }
    setGradingSystemDialogOpen(false);
  };

  // Split rows currently shown on the TOR into two visual columns,
  // matching the original two-block layout (left block / right block).
  const gradingSystemHalf = Math.ceil(gradingSystemRows.length / 2);
  const gradingSystemFirstHalf = gradingSystemRows.slice(0, gradingSystemHalf);
  const gradingSystemSecondHalf = gradingSystemRows.slice(gradingSystemHalf);

  // ---- Graduation date (not covered by torRoute.txt — kept local for now) ----
  const GRADUATION_DATE_STORAGE_KEY = "tor_graduation_date";
  const [graduationDate, setGraduationDate] = useState(() => {
    try {
      return localStorage.getItem(GRADUATION_DATE_STORAGE_KEY) || "";
    } catch (err) {
      return "";
    }
  });
  const handleGraduationDateChange = (e) => {
    const value = e.target.value;
    setGraduationDate(value);
    try {
      localStorage.setItem(GRADUATION_DATE_STORAGE_KEY, value);
    } catch (err) {
      console.error("Failed to save graduation date:", err);
    }
  };

  const formattedDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const todayDate = new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const formattedGraduationDate = graduationDate
    ? formattedDate(graduationDate)
    : "____________________";

  const dateIssuedDisplay = graduationDate ? formattedDate(graduationDate) : todayDate;

  const getPageRemarksText = (isLastPage, degree) => {
    if (isLastPage) {
      const degreeLabel = degree || "____________________";
      return `GRADUATED with the Degree of ${degreeLabel} from this Institute on ${formattedGraduationDate}`;
    }
    return remarks;
  };


  const [admissionCredentialsNote, setAdmissionCredentialsNote] = useState(() => {
    try {
      const stored = localStorage.getItem(ADMISSION_CREDENTIALS_STORAGE_KEY);
      if (stored) return stored;
    } catch (err) {
      console.error("Failed to load admission credentials note:", err);
    }
    return DEFAULT_ADMISSION_CREDENTIALS;
  });
  const [admissionCredentialsDialogOpen, setAdmissionCredentialsDialogOpen] = useState(false);
  const [admissionCredentialsDraft, setAdmissionCredentialsDraft] = useState("");


  const openAdmissionCredentialsDialog = () => {
    setAdmissionCredentialsDraft(admissionCredentialsNote);
    setAdmissionCredentialsDialogOpen(true);
  };
  const closeAdmissionCredentialsDialog = () => setAdmissionCredentialsDialogOpen(false);
  const handleSaveAdmissionCredentials = () => {
    const cleaned = admissionCredentialsDraft.trim() || DEFAULT_ADMISSION_CREDENTIALS;
    setAdmissionCredentialsNote(cleaned);
    try {
      localStorage.setItem(ADMISSION_CREDENTIALS_STORAGE_KEY, cleaned);
    } catch (err) {
      console.error("Failed to save admission credentials note:", err);
    }
    setAdmissionCredentialsDialogOpen(false);
  };

  const [creditsNote, setCreditsNote] = useState(() => {
    try {
      const stored = localStorage.getItem(CREDITS_NOTE_STORAGE_KEY);
      if (stored) return stored;
    } catch (err) { console.error("Failed to load credits note:", err); }
    return DEFAULT_CREDITS_NOTE;
  });
  const [institutionNote, setInstitutionNote] = useState(() => {
    try {
      const stored = localStorage.getItem(INSTITUTION_NOTE_STORAGE_KEY);
      if (stored) return stored;
    } catch (err) { console.error("Failed to load institution note:", err); }
    return DEFAULT_INSTITUTION_NOTE;
  });
  const [footerNotesDialogOpen, setFooterNotesDialogOpen] = useState(false);
  const [creditsNoteDraft, setCreditsNoteDraft] = useState("");
  const [institutionNoteDraft, setInstitutionNoteDraft] = useState("");

  const openFooterNotesDialog = () => {
    setCreditsNoteDraft(creditsNote);
    setInstitutionNoteDraft(institutionNote);
    setFooterNotesDialogOpen(true);
  };
  const closeFooterNotesDialog = () => setFooterNotesDialogOpen(false);
  const handleSaveFooterNotes = () => {
    const cleanedCredits = creditsNoteDraft.trim() || DEFAULT_CREDITS_NOTE;
    const cleanedInstitution = institutionNoteDraft.trim() || DEFAULT_INSTITUTION_NOTE;
    setCreditsNote(cleanedCredits);
    setInstitutionNote(cleanedInstitution);
    try {
      localStorage.setItem(CREDITS_NOTE_STORAGE_KEY, cleanedCredits);
      localStorage.setItem(INSTITUTION_NOTE_STORAGE_KEY, cleanedInstitution);
    } catch (err) { console.error("Failed to save footer notes:", err); }
    setFooterNotesDialogOpen(false);
  };

  // ✅ Fetch person data from backend
  const fetchPersonData = async (id) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/person/${id}`);
      setPerson(res.data); // make sure backend returns the correct format
    } catch (error) {
      console.error("Failed to fetch person:", error);
    }
  };

  const location = useLocation();
  const [signatures, setSignatures] = useState([]);
  const [selectedPreparedBy, setSelectedPreparedBy] = useState(null);
  const [selectedCheckedBy, setSelectedCheckedBy] = useState(null);
  const [selectedRegistrar, setSelectedRegistrar] = useState(null);
  const [signaturePage, setSignaturePage] = useState(0);

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      setUserID(storedID);

      if (storedRole === "applicant" || storedRole === "registrar") {
        fetchPersonData(storedID);
      } else {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [employeeID, setEmployeeID] = useState("");
  const [studentData, setStudentData] = useState([]);
  const [studentNumber, setStudentNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [studentDetails, setStudentDetails] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");




  const allBranchNames = branches
    .map((b) => b?.branch || b?.branch_name)
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();

  useEffect(() => {
    if (!settings) return;

    const branchId =
      studentData?.campus ||
      studentData?.branch_id ||
      person?.campus ||
      person?.branch_id;
    const matchedBranch = branches.find(
      (branch) =>
        String(branch?.id ?? branch?.branch_id) === String(branchId),
    );

    if (
      matchedBranch?.address ||
      matchedBranch?.branch_address ||
      matchedBranch?.campus_address
    ) {
      setCampusAddress(
        matchedBranch.address ||
        matchedBranch.branch_address ||
        matchedBranch.campus_address,
      );
      return;
    }

    if (branding.campusAddress) {
      setCampusAddress(branding.campusAddress);
      return;
    }

    setCampusAddress(branding.campusAddress || "");
  }, [
    settings,
    branches,
    studentData?.campus,
    studentData?.branch_id,
    person?.campus,
    person?.branch_id,
    branding.campusAddress,
  ]);

  // Auto-fill/search from URL person_id or student_number (same pattern as Report of Grades / Search COR)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const studentNumberFromUrl = params.get("student_number")?.trim();
    const personIdFromUrl = params.get("person_id")?.trim();

    if (!studentNumberFromUrl && !personIdFromUrl) return;

    let cancelled = false;

    const applyStudentNumber = (resolvedStudentNumber) => {
      if (cancelled || !resolvedStudentNumber) return;
      setSearchQuery(resolvedStudentNumber);
      sessionStorage.setItem("edit_student_number", resolvedStudentNumber);
    };

    const skipAutoSearchForInactiveTerm = async () => {
      const listYearId = sessionStorage.getItem("edit_list_year_id");
      const listSemesterId = sessionStorage.getItem("edit_list_semester_id");

      // Only gate auto-search when the student was picked under a specific list term.
      if (!listYearId || !listSemesterId) return false;

      try {
        const res = await axios.get(`${API_BASE_URL}/api/active_school_year`);
        const active =
          Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
        if (!active) return false;

        const sameYear = String(active.year_id) === String(listYearId);
        const sameSemester =
          String(active.semester_id) === String(listSemesterId);
        if (sameYear && sameSemester) return false;

        setSearchQuery("");
        setSelectedStudent(null);
        setStudentData([]);
        setStudentDetails([]);
        setSnackbarMessage(
          "Selected student is from a different school year/semester than the active term. Search manually if needed.",
        );
        setOpenSnackbar(true);
        return true;
      } catch (err) {
        console.error(
          "Failed to verify active school year for auto-search:",
          err,
        );
        return false;
      }
    };

    const runAutoSearch = async () => {
      const shouldSkip = await skipAutoSearchForInactiveTerm();
      if (cancelled || shouldSkip) return;

      if (studentNumberFromUrl) {
        applyStudentNumber(studentNumberFromUrl);
        return;
      }

      setSearchQuery("");
      setSelectedStudent(null);
      setStudentData([]);
      setStudentDetails([]);

      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/student-person-data/${personIdFromUrl}`,
        );
        if (cancelled) return;
        const resolvedStudentNumber = res.data?.student_number;
        if (resolvedStudentNumber) {
          applyStudentNumber(resolvedStudentNumber);
          sessionStorage.setItem("edit_person_id", personIdFromUrl);
        } else {
          setSnackbarMessage(
            "No student number found for the selected person.",
          );
          setOpenSnackbar(true);
        }
      } catch (err) {
        console.error("Auto Transcript of Records search failed:", err);
        setSnackbarMessage(
          "Unable to load student number for the selected person.",
        );
        setOpenSnackbar(true);
      }
    };

    runAutoSearch();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const pageId = 62;
  const SIGNATURES_PER_PAGE = 5;

  //Put this After putting the code of the past code
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
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`,
      );
      if (response.data && response.data.page_privilege === 1) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
      if (error.response && error.response.data.message) {
        console.log(error.response.data.message);
      } else {
        console.log("An unexpected error occurred.");
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 5) {
      setSelectedStudent(null);
      setStudentData([]);
      return;
    }

    const fetchStudent = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/program_evaluation/${searchQuery}`,
        );
        const data = await res.json();

        if (data) {
          setSelectedStudent(data);
          setStudentData(data);

          if (searchQuery) {
            localStorage.setItem("admin_edit_person_id", searchQuery);
          }

          const detailsRes = await fetch(
            `${API_BASE_URL}/api/program_evaluation/details/${searchQuery}`,
          );
          const detailsData = await detailsRes.json();
          if (Array.isArray(detailsData) && detailsData.length > 0) {
            setStudentDetails(detailsData);
          } else {
            setStudentDetails([]);
            setSnackbarMessage("No enrolled subjects found for this student.");
            setOpenSnackbar(true);
          }
        } else {
          setSelectedStudent(null);
          setStudentData([]);
          setStudentDetails([]);
          setSnackbarMessage("No student data found.");
          setOpenSnackbar(true);
        }
      } catch (err) {
        console.error("Error fetching student", err);
        setSnackbarMessage("Server error. Please try again.");
        localStorage.removeItem("admin_edit_person_id");
        setOpenSnackbar(true);
      }
    };

    fetchStudent();
  }, [searchQuery]);

  useEffect(() => {
    const query = studentNumber.trim();

    if (!suggestionsOpen || query.length < 2) {
      setStudentSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/cor-student-suggestions`, {
          params: { query, limit: 10 },
        });

        if (!cancelled) {
          setStudentSuggestions(res.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch Transcript student suggestions:", err);
        if (!cancelled) setStudentSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(delayDebounce);
    };
  }, [studentNumber, suggestionsOpen]);

  const handleSuggestionSelect = (suggestion) => {
    const nextStudentNumber = String(suggestion?.student_number || "");
    if (!nextStudentNumber) return;

    setStudentNumber(nextStudentNumber);
    setSearchQuery(nextStudentNumber);
    setSuggestionsOpen(false);
    setStudentSuggestions([]);
  };

  useEffect(() => {
    const fetchSignatures = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/signature`);
        setSignatures(res.data?.success ? res.data.data || [] : []);
        setSignaturePage(0);
      } catch (err) {
        console.error(err);
        setSignatures([]);
      }
    };
    fetchSignatures();
  }, []);

  useEffect(() => {
    fetchGradeConversionDic();
  }, [])

  const fetchGradeConversionDic = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/grade-conversion`);
      setGradeConversions(Array.isArray(res.data) ? res.data : []);

      console.log("Fetch successful");
    } catch (err) {
      console.log("Error Fetching Data: ", err);
      setGradeConversions([]);
    }
  };

  const paginatedSignatures = signatures.slice(
    signaturePage * SIGNATURES_PER_PAGE,
    signaturePage * SIGNATURES_PER_PAGE + SIGNATURES_PER_PAGE,
  );
  const totalSignaturePages = Math.max(
    1,
    Math.ceil(signatures.length / SIGNATURES_PER_PAGE),
  );

  const getSignatureImageSrc = (signature) =>
    signature?.signature_image
      ? `${API_BASE_URL}/uploads/${signature.signature_image}`
      : "";

  const totalUnitPerSubject = (course_unit, lab_unit) => {
    const lec = Number(course_unit) || 0;
    const lab = Number(lab_unit) || 0;
    return lec + lab;
  };

  const groupedDetails = {};
  if (Array.isArray(studentDetails)) {
    studentDetails.forEach((item) => {
      const key = `${item.school_year}-${item.semester_description}`;
      if (!groupedDetails[key]) {
        groupedDetails[key] = [];
      }
      groupedDetails[key].push(item);
    });
  }

  const convertSemester = (p) => {
    if (!p) return "";

    // ✅ Single source of truth — comes straight from semester_table.ordinal_label
    if (p.ordinal_label) return p.ordinal_label;

    // Fallback: no hardcoded mapping, just show whatever the DB already has
    return p.semester_description || "";
  };

  const groupedSubjects = Object.entries(groupedDetails).map(
    ([key, courses]) => ({
      termKey: key,
      year: courses[0]?.current_year,
      nextYear: courses[0]?.next_year,
      semester: courses[0]?.semester_description,
      subjects: courses,
    }),
  );

  // Constants
  const MAX_PAGE_HEIGHT_REM = 47;
  const SUBJECT_HEIGHT_REM = 1.1;
  const MAX_SUBJECTS_PER_PAGE = Math.floor(
    MAX_PAGE_HEIGHT_REM / SUBJECT_HEIGHT_REM,
  );

  // Function to chunk subjects into pages
  const chunkArray = (arr, maxSubjects) => {
    const result = [];
    let currentPage = [];
    let currentCount = 0;

    for (const group of arr) {
      let remainingSubjects = [...group.subjects];
      let isContinuation = false;

      while (remainingSubjects.length > 0) {
        const availableSpace = maxSubjects - currentCount;

        if (remainingSubjects.length <= availableSpace) {
          // All subjects fit on this page
          currentPage.push({
            ...group,
            subjects: remainingSubjects,
            isContinuation,
          });
          currentCount += remainingSubjects.length;
          remainingSubjects = [];
        } else {
          // Some subjects fit, others overflow → split group
          const fitSubjects = remainingSubjects.slice(0, availableSpace);
          const overflowSubjects = remainingSubjects.slice(availableSpace);

          currentPage.push({
            ...group,
            subjects: fitSubjects,
            isContinuation,
          });
          result.push(currentPage);

          // start new page with remaining subjects
          currentPage = [];
          currentCount = 0;
          remainingSubjects = overflowSubjects;
          isContinuation = true; // mark next split as continuation
        }

        if (currentCount >= maxSubjects) {
          result.push(currentPage);
          currentPage = [];
          currentCount = 0;
        }
      }
    }

    if (currentPage.length > 0) result.push(currentPage);

    return result;
  };

  const paginatedSubjects = chunkArray(groupedSubjects, MAX_SUBJECTS_PER_PAGE);

  const divToPrintRef = useRef();

  const printDiv = () => {
    window.print();
  };

  const buildTorPageHtml = (pageGroups, pageIndex) => {
    const logoSrc = logoDataUris.school || fetchedLogo || EaristLogo;
    const name = companyName?.trim() || "";
    const words = name.split(" ");
    const middle = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, middle).join(" ");
    const secondLine = words.slice(middle).join(" ");

    const studentName = formatStudentFullName(studentData);

    const admissionCredentials = admissionCredentialsNote;

    const dateIssuedDisplay = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const degreeTitle = studentData?.program_description
      ? studentData.program_description.toUpperCase()
      : "";
    const major = studentData?.major ? studentData.major.toUpperCase() : "";

    const photoSrc = studentData?.profile_image
      ? `${API_BASE_URL}/uploads/Student1by1/${studentData.profile_image}`
      : "";

    // ── Header ──
    const headerHtml = `
    <div style="position:relative; width:80rem; margin:0 auto;">
      <div style="position:absolute; top:0; right:0; display:flex; flex-direction:column; align-items:center; z-index:2;">
        <div style="display:flex; align-items:center; gap:4px;">
          <img src="${logoDataUris.act || Act}" alt="ACT" style="width:50px; height:50px; object-fit:contain; display:block;" />
          <img src="${logoDataUris.ukas || Ukas}" alt="UKAS" style="width:50px; height:50px; object-fit:contain; display:block;" />
          <img src="${logoDataUris.iaf || Iaf}" alt="IAF" style="width:50px; height:50px; object-fit:contain; display:block;" />
        </div>
        <div style="font-size:11px; text-align:center; margin-top:20px; line-height:1.2; font-family:Arial, sans-serif;">
          ${(shortTerm || "").toUpperCase()} FORM NO. I-A<br/>
          REVISED 2025
        </div>
      </div>

      <div style="display:flex; align-items:center; justify-content:center; margin-top: -20px;">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-left:-10rem; padding-right:3rem;">
          <img src="${logoDataUris.bagongPilipinas || BagongPilipinasLogo}" alt="Bagong Pilipinas" style="width:8.5rem; height:8rem; display:block;" />
          <img src="${logoSrc}" alt="Logo" style="width:8rem; height:8rem; border-radius:50%; display:block;" />
        </div>
        <div style="text-align:center;">
          <div style="font-family:Arial, sans-serif; font-size:13px;">Republic of the Philippines</div>
          ${name ? `
            <div style="line-height:1; font-size:1.6rem; letter-spacing:-1px; font-weight:600; font-family:'Arial'; text-transform:'uppercase'; ">${firstLine}</div>
            ${secondLine ? `<div style="line-height:1; font-size:1.6rem; letter-spacing:-1px; font-weight:600; font-family:'Arial; text-transform:'uppercase';">${secondLine}</div>` : ""}
          ` : ""}
          ${allBranchNames ? `
            <div style="font-size:14px; font-weight:bold; letter-spacing:0.5px; margin-top:-2px;">
              ${allBranchNames}
            </div>
          ` : ""}
          <div style="font-family:Arial, sans-serif; font-size:13px;">${campusAddress || ""}</div>
        </div>
      </div>

      <div style="text-align:center; font-size:1.6rem; letter-spacing:-1px; font-weight:500;">
        OFFICE OF THE REGISTRAR
      </div>
      <div style="text-align:center; margin-top:-0.5rem; font-size:2.75rem; letter-spacing:-1px; font-weight:600;">
        OFFICIAL TRANSCRIPT OF RECORDS
      </div>
    </div>
  `;

    // ── Student info + photo ──
    const infoRow = (label, value) => `
    <div style="display:flex; height:20px; align-items:center; font-size:20px; letter-spacing:-1px; margin-top:2px;">
      <span style="width:15rem;">${label}</span>
      <span style="width:1rem;">:</span>
      <span style="font-weight:500; margin-left:0.3rem;">${value || ""}</span>
    </div>
  `;

    const studentInfoHtml = `
    <div style="display:flex; margin-top:1rem; width:80rem; margin-left:auto; margin-right:auto; border-bottom:solid black 1px; padding-bottom:0.5rem;">
      <div style="flex:1 1 auto;">
        <div style="display:flex; align-items:center; font-size:22px; font-weight:600; letter-spacing:-1px;">
          <span style="width:15rem;">NAME</span>
          <span style="width:1rem;">:</span>
          <span style="margin-left:0.3rem;">${studentName}</span>
        </div>
        ${infoRow("DATE OF BIRTH", formattedDate(studentData.birthOfDate))}
        ${infoRow("ADMISSION CREDENTIALS", admissionCredentials)}
        ${infoRow("LAST SCHOOL ATTENDED", studentData.schoolLastAttended1)}
        ${infoRow("DATE GRADUATED", formatYearGraduatedRange(studentData.yearGraduated1))}
        ${infoRow("STUDENT NUMBER", studentData.student_number)}
        ${infoRow("DEGREE/TITLE EARNED", degreeTitle)}
        ${infoRow("MAJOR", major)}
        ${infoRow("DATE OF GRADUATION", dateIssuedDisplay)}
      </div>
      <div style="flex:0 0 225px; margin-left:1rem;">
        ${photoSrc
        ? `<img src="${photoSrc}" style="width:225px; height:225px; object-fit:cover; border:1px solid black; display:block;" />`
        : `<div style="width:225px; height:225px; border:1px solid black;"></div>`
      }
      </div>
    </div>
  `;

    // ── Subjects table (div-based, no table/flex hybrid) ──
    const tableHeaderHtml = `
    <div style="display:flex; height:65px; align-items:center; border-bottom:solid 1px black; font-weight:600; font-size:20px;">
      <div style="width:13rem; text-align:center;">TERM</div>
      <div style="width:38rem; text-align:center; letter-spacing:-1px;">
        SUBJECTS<br/>
        <span style="font-weight:600;">CODE NUMBER WITH DESCRIPTIVE TITLE</span>
      </div>
      <div style="width:13rem; text-align:center;">
        GRADES
        <div style="display:flex; margin-top:2px;">
          <div style="width:6rem; text-align:center;">FINAL</div>
          <div style="width:7rem; text-align:center;">RE-EXAM</div>
        </div>
      </div>
      <div style="width:7rem; text-align:center;">CREDITS</div>
      <div style="width:8.9rem; text-align:center;">REMARKS</div>
    </div>
  `;

    const programRowHtml = `
    <div style="text-decoration:underline; text-underline-offset:3px; font-weight:500; letter-spacing:-1px; padding-left:1.5rem; font-size:20px;">
      ${degreeTitle}
    </div>
  `;

    let subjectRowsHtml = "";
    pageGroups.forEach((group) => {
      group.subjects.forEach((p, index) => {
        const componentLabel =
          p.component === 1 ? "CWTS" :
            p.component === 2 ? "LTS" :
              p.component === 3 ? "MTS" : "";
        const finalGrade = handleGradeConversion(p.final_grade || p.numeric_grade);
        const totalUnits = totalUnitPerSubject(p.course_unit, p.lab_unit);
        const remarks =
          p.en_remarks === 0 ? "Ongoing" :
            p.en_remarks === 1 ? "Passed" :
              p.en_remarks === 2 ? "Failed" :
                p.en_remarks === 3 ? "Incomplete" :
                  p.en_remarks === 4 ? "Dropped" : "";

        subjectRowsHtml += `
        <div style="display:flex; align-items:flex-start; line-height:22px;">
          <div style="width:13rem; display:flex; flex-direction:column; align-items:flex-start;">
            ${!group.isContinuation && index === 0 ? `
              <span style="font-size:18px; text-align:center; width:13rem; font-weight:500;">${convertSemester(p)}</span>              <span style="font-size:17px; text-align:center; width:13rem; font-weight:500;">${p.current_year} - ${p.next_year}</span>
            ` : ""}
          </div>
          <div style="display:flex; width:38rem; line-height:22px;">
            <span style="width:9.5rem; flex:0 0 9.5rem; font-size:18px; letter-spacing:-0.5px;">${p.course_code || ""}</span>
            <span style="flex:1 1 auto; font-size:18px; letter-spacing:-0.5px;">${p.course_description ? p.course_description.toUpperCase() : ""} ${componentLabel}</span>
          </div>
          <div style="width:13rem; display:flex; align-items:center;">
            <div style="width:6rem; text-align:center; font-size:18px;">${finalGrade}</div>
            <div style="width:7rem; text-align:center; font-size:18px;"></div>
          </div>
          <div style="width:7rem; text-align:center; font-size:18px;">${totalUnits}</div>
          <div style="width:8.9rem; text-align:center; font-size:18px;">${remarks}</div>
        </div>
      `;
      });
    });

    const isLastPage = pageIndex === paginatedSubjects.length - 1;
    const nothingFollowsHtml = isLastPage
      ? `
      <div style="text-align:center; font-size:17px; font-weight:600; white-space:normal; overflow:visible; line-height:1.3; word-break:break-word;">
      <span style="font-size:14px;">${repeatShortTermWithSpaces(shortTerm)} xxx</span>
&nbsp;NOTHING FOLLOWS&nbsp;
<span style="font-size:14px;">xxx ${repeatShortTermWithSpaces(shortTerm)}</span>
      </div>
    `
      : `
      <div style="text-align:center; border-top:dashed 1px black; font-size:17px; font-weight:600;">
        - continued on next page -
      </div>
    `;

    const subjectsTableHtml = `
    <div style="margin-top:0.5rem; width:80rem; margin-left:auto; margin-right:auto; border-top:solid black 1px;">
      ${tableHeaderHtml}
      ${programRowHtml}
      ${subjectRowsHtml}
      ${nothingFollowsHtml}
    </div>
  `;

    const gradeCol = (rows, width) => `
  <div style="display:flex; flex-direction:column; align-items:flex-start; width:${width};">
    ${rows.map((r) => `<div style="font-size:16px; letter-spacing:-1px;">${r}</div>`).join("")}
  </div>
`;

    const gradingSystemHtml = `
  <div style="display:flex; height:145px; border-top:solid 1px black; font-size:18px; align-items:flex-start; padding-top:3px;">
    <div style="width:13rem;">GRADING SYSTEM</div>
    ${gradeCol(gradingSystemFirstHalf.map((r) => r.equivalent_grade), "4.5rem")}
    ${gradeCol(gradingSystemFirstHalf.map((r) => `(${r.min_score}-${r.max_score})`), "6.5rem")}
    ${gradeCol(gradingSystemFirstHalf.map((r) => r.description), "15.5rem")}
    ${gradeCol(gradingSystemSecondHalf.map((r) => r.equivalent_grade), "4.5rem")}
    ${gradeCol(gradingSystemSecondHalf.map((r) => `(${r.min_score}-${r.max_score})`), "14rem")}
    ${gradeCol(gradingSystemSecondHalf.map((r) => r.description), "22rem")}
  </div>
`;

    const pageRemarksText = getPageRemarksText(isLastPage, degreeTitle);

    const creditsNoteHtml = `
    <div style="padding-left:2rem; height:35px; border-bottom:solid 1px black; font-size:18px; display:flex; align-items:center;">
      <span>${creditsNote}</span>
    </div>
    <div style="padding-left:2rem; height:65px; border-bottom:solid 1px black; font-size:17px; padding-top:8px;">
      <span style="font-size:18px; letter-spacing:-0.8px;">${(companyName || "").toUpperCase()}</span>
      <span style="letter-spacing:-0.8px;"> ${institutionNote}</span>
    </div>
    <div style="padding-left:1rem; height:65px; border-top:solid 1px black; border-bottom:solid 1px black; font-size:18px; padding-top:8px;">
      <span style="font-weight:600;">REMARKS: </span>
      <span style="font-weight:400;">${pageRemarksText}</span>
    </div>
    <div style="padding-left:1rem; height:35px; font-size:18px; padding-top:3px;">
      <span>DATE ISSUED: </span><span>${dateIssuedDisplay}</span>
    </div>
  `;

    const signatureBlock = (label, signature) => `
    <div style="width:20rem;">
      <span style="font-size:18px; letter-spacing:-0.8px;">${label}</span>
      <div style="margin-top:0.4rem; text-align:left;">
        ${signature?.signature_image
        ? `<img src="${getSignatureImageSrc(signature)}" style="width:11rem; height:2.7rem; object-fit:contain; display:block; margin-bottom:-0.2rem;" />`
        : ""
      }
        <span style="display:block; font-size:20px; font-weight:500; letter-spacing:-1px; white-space:nowrap;">
          ${signature?.full_name?.toUpperCase() || ""}
        </span>
      </div>
    </div>
  `;

    const registrarBlock = `
    <div style="width:21rem; text-align:center; display:flex; flex-direction:column; align-items:center;">
      ${selectedRegistrar?.signature_image
        ? `<img src="${getSignatureImageSrc(selectedRegistrar)}" style="width:11rem; height:2.7rem; object-fit:contain; display:block; margin-bottom:-0.2rem;" />`
        : ""
      }
      <span style="font-size:24px; letter-spacing:-2px;">${selectedRegistrar?.full_name?.toUpperCase() || ""}</span>
      <hr style="width:100%;" />
      <span style="font-size:18px; letter-spacing:-1px;">REGISTRAR</span>
    </div>
  `;

    const signaturesHtml = `
    <div style="display:flex; padding-left:1rem; height:9rem; border-bottom:solid black 1px; align-items:flex-start;">
      <div style="width:17rem;"></div>
      ${signatureBlock("PREPARED BY:", selectedPreparedBy)}
      ${signatureBlock("CHECKED BY:", selectedCheckedBy)}
      ${registrarBlock}
    </div>
  `;

    // ── Footer: all campus addresses (Manila / Cavite, etc) ──
    const allCampusAddressesHtml = `
    <div style="width:80rem; margin-left:auto; margin-right:auto; margin-top:0.4rem; padding-top:0.3rem; border-top:solid 1px black; display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:1.5rem;">
      ${branches
        .filter((b) => b?.address || b?.branch_address || b?.campus_address)
        .map(
          (b, index, arr) => `
          <span style="font-size:14px; letter-spacing:-0.3px; white-space:nowrap;">
            <span style="font-weight:700;">${(b.branch || b.branch_name || "").toUpperCase()}:</span>
            ${b.address || b.branch_address || b.campus_address}
            ${index < arr.length - 1 ? `<span style="margin:0 0.75rem;">|</span>` : ""}
          </span>
        `,
        )
        .join("")}
    </div>
  `;

    return `
    <div class="tor-page">
      ${headerHtml}
      ${studentInfoHtml}
      ${subjectsTableHtml}
      <div style="width:80rem; margin-left:auto; margin-right:auto; margin-top:0.5rem;">
        ${gradingSystemHtml}
        ${creditsNoteHtml}
        ${signaturesHtml}
        ${allCampusAddressesHtml}
      </div>
    </div>
  `;
  };


  const handleExportTorPdf = async () => {
    if (paginatedSubjects.length === 0) {
      setSnackbarMessage("No subjects found to generate the transcript.");
      setOpenSnackbar(true);
      return;
    }

    let allPagesHtml;
    try {
      allPagesHtml = paginatedSubjects
        .map((pageGroups, pageIndex) => buildTorPageHtml(pageGroups, pageIndex))
        .join("");
    } catch (err) {
      console.error("Failed to build TOR page HTML:", err);
      setSnackbarMessage("Failed to prepare the Transcript of Records for download.");
      setOpenSnackbar(true);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/generate-tor-pdf`,
        {
          html: allPagesHtml,
          student_number: studentData.student_number || "",
          last_name: studentData?.last_name || "",
          first_name: studentData?.first_name || "",
          audit_print_action: "PRINTING_STUDENT_DOCS",
          document_label: "Transcript of Records",
        },
        {
          responseType: "blob",
          headers: getFlatAuditHeaders({
            "x-employee-id": employeeID,
            "x-page-id": pageId,
          }),
        },
      );

      const blobUrl = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute(
        "download",
        `TOR_${(studentData?.last_name || "Student").replace(/\s+/g, "_")}${studentData.student_number ? "_" + studentData.student_number : ""}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to generate TOR PDF:", err);
      setSnackbarMessage("Failed to generate Transcript of Records PDF.");
      setOpenSnackbar(true);
    }
  };


  const handleTorEditCardClick = (key) => {
    switch (key) {
      case "capturePhoto":
        if (!studentData?.person_id) {
          setSnackbarMessage("Please search and select a student first.");
          setOpenSnackbar(true);
          return;
        }
        setPhotoCaptureOpen(true);
        break;
      case "remarks":
        openRemarksDialog();
        break;
      case "admissionCredentials":
        openAdmissionCredentialsDialog();
        break;
      case "footerNotes":
        openFooterNotesDialog();
        break;
      case "gradingSystem":
        openGradingSystemDialog();
        break;
      default:
        break;
    }
  };

  const handlePreparedByChange = (signature) => {
    setSelectedPreparedBy((prev) =>
      prev?.id === signature.id ? null : signature,
    );
  };

  const handleCheckedByChange = (signature) => {
    setSelectedCheckedBy((prev) =>
      prev?.id === signature.id ? null : signature,
    );
  };

  const handleRegistrarChange = (signature) => {
    setSelectedRegistrar((prev) =>
      prev?.id === signature.id ? null : signature,
    );
  };

  const isSignatureSelectedForAnotherRole = (signature, currentRole) => {
    const selections = {
      prepared: selectedPreparedBy,
      checked: selectedCheckedBy,
      registrar: selectedRegistrar,
    };

    return Object.entries(selections).some(
      ([role, selected]) => role !== currentRole && selected?.id === signature.id,
    );
  };

  const handleGradeConversion = (grade) => {
    if (grade === null || grade === undefined || grade === "") return "";

    const normalizedGrade = String(grade).trim().toUpperCase();

    if (normalizedGrade === "0" || Number(normalizedGrade) === 0) return "";
    if (normalizedGrade === "INC") return "INC";
    if (normalizedGrade === "DROP" || normalizedGrade === "DRP") return "DRP";

    const numericGrade = Number(normalizedGrade);
    if (Number.isNaN(numericGrade)) return grade;

    if (numericGrade > 0 && numericGrade <= 5) {
      return Number.isInteger(numericGrade)
        ? String(numericGrade)
        : numericGrade.toFixed(2);
    }

    const matchedConversion = gradeConversion.find((row) => {
      const minScore = Number(row.min_score);
      const maxScore = Number(row.max_score);

      return (
        Number.isFinite(minScore) &&
        Number.isFinite(maxScore) &&
        numericGrade >= minScore &&
        numericGrade <= maxScore
      );
    });

    if (!matchedConversion?.equivalent_grade) {
      return grade;
    }

    const equivalentGrade = Number(matchedConversion.equivalent_grade);
    return Number.isNaN(equivalentGrade)
      ? matchedConversion.equivalent_grade
      : equivalentGrade.toFixed(2);
  };

  // Put this at the very bottom before the return
  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
  }

  // 🔒 Disable right-click
  // document.addEventListener("contextmenu", (e) => e.preventDefault());

  // // 🔒 Block DevTools shortcuts + Ctrl+P silently
  // document.addEventListener("keydown", (e) => {
  //   const isBlockedKey =
  //     e.key === "F12" ||
  //     e.key === "F11" ||
  //     (e.ctrlKey &&
  //       e.shiftKey &&
  //       (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
  //     (e.ctrlKey && e.key.toLowerCase() === "u") ||
  //     (e.ctrlKey && e.key.toLowerCase() === "p");

  //   if (isBlockedKey) {
  //     e.preventDefault();
  //     e.stopPropagation();
  //   }
  // });

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
        className="navbars"
        sx={{
          display: "flex",
          background: "white",
          alignItems: "center",
          justifyContent: "space-between",

          mb: 2,
        }}
      >
        {/* Left: Title */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            color: titleColor,
            fontSize: "36px",
            background: "white",
            display: "flex",
            alignItems: "center",
          }}
        >
          TRANSCRIPT OF RECORDS
        </Typography>

        {/* Right: Search + Print grouped together */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ position: "relative", width: 450 }}>
            <TextField
              variant="outlined"
              placeholder="Search student number or name"
              size="small"
              value={studentNumber}
              onChange={(e) => {
                const nextValue = e.target.value;
                const trimmedValue = nextValue.trim();
                setStudentNumber(nextValue);
                setSearchQuery(/^\d/.test(trimmedValue) ? nextValue : "");
                setSuggestionsOpen(true);
              }}
              onFocus={() => {
                if (studentNumber.trim().length >= 2) setSuggestionsOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => setSuggestionsOpen(false), 150);
              }}
              sx={{
                width: "100%",
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
            {suggestionsOpen && studentNumber.trim().length >= 2 && (
              <Box
                sx={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  backgroundColor: "#fff",
                  border: "1px solid #d0d0d0",
                  borderRadius: "8px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                  overflow: "hidden",
                  maxHeight: 320,
                }}
              >
                {suggestionsLoading ? (
                  <Box sx={{ px: 2, py: 1.25, fontSize: 13, color: "#666" }}>
                    Searching...
                  </Box>
                ) : studentSuggestions.length > 0 ? (
                  studentSuggestions.map((suggestion) => {
                    const name = formatSuggestionName(suggestion);
                    return (
                      <Box
                        key={`${suggestion.student_number}-${suggestion.person_id}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSuggestionSelect(suggestion);
                        }}
                        sx={{
                          px: 2,
                          py: 1,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          fontSize: 14,
                          borderBottom: "1px solid #f0f0f0",
                          "&:hover": {
                            backgroundColor: "#f5f7fb",
                          },
                        }}
                      >
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                          {suggestion.student_number}
                        </Typography>
                        <Typography sx={{ fontSize: 14, color: "#555" }}>
                          |
                        </Typography>
                        <Typography sx={{ fontSize: 14 }} noWrap>
                          {name || "Unnamed Student"}
                        </Typography>
                      </Box>
                    );
                  })
                ) : (
                  <Box sx={{ px: 2, py: 1.25, fontSize: 13, color: "#666" }}>
                    No matching students found
                  </Box>
                )}
              </Box>
            )}
          </Box>

          <button
            onClick={handleExportTorPdf}

            style={{
              padding: "5px 20px",
              border: "2px solid black",
              backgroundColor: "#f0f0f0",
              color: "black",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              transition: "background-color 0.3s, transform 0.2s",
              height: "40px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              userSelect: "none",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#d3d3d3")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#f0f0f0")
            }
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.95)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            type="button"
          >
            <FcPrint size={20} />
            Download TOR
          </button>
        </Box>
      </Box>



      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />

      <br />
      <RegistrarEnrollmentTabs />
      <br />
      <br />
      <style>
        {`
            /* ===== Screen-only "separate pages" look =====
               These rules are NOT inside @media print, so they apply
               only to normal on-screen viewing. Each print-container
               (one per physical page) gets its own card styling with
               a fixed page size, border, shadow and gap so pages look
               visually separated instead of one continuous block. */
            .page-container {
                background: #e7e7e7;
                padding-top: 2rem;
            }
            .page-card {
                background: white;
                border: 1px solid #b8b8b8;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14);
                box-sizing: border-box;
                width: fit-content;
                min-width: 215.9mm;
               min-height: 355.6mm;
                padding: 10mm 12mm;
                margin: 0 auto 2.5rem;
            }

            @media print {
                @page {
                    margin: 0 !important; 
                    padding: 0 !important;
                      size: 215.9mm 355.6mm;
                }
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    height: auto;
                    position: relative
                }
                body * {
                    visibility: hidden;
                }
                .body, .page {
                    display: block !important;
                    overflow: visible !important;
                    height: auto !important;
                    max-height: none !important;
                }
                .page {
                    zoom: 0.85 !important;
                    position: absolute;
                    top: 0;
                    left: 26%;
                }
                .print-container, .print-container *, .page, .page *{
                    visibility: visible;
                }
                .print-container {
                    display: block;
                    width: 100%;
                    position: relative;
                    margin-top: 0 !mportant;
                    margin-bottom: 0 !mportant;
                    margin-right: 0 !mportant;
                    padding: 0 !important;
                    min-height: 13.5in;
                    margin-left: -23.5%;
                    font-family: "Arial";
                }
                .print-container:first-child {
                    page-break-after: auto;
                }
                .page-container{
                    display: block !important;
                    background: transparent !important;
                    padding: 0 !important;
                }   
                .print-container:last-child {
                    page-break-after: auto;
                    margin-top: 0;
                }
                .print-container:first-child .page-header{
                    top: 0;
                }
                .page-header{
                    margin-top: -0.5rem !important;
                    height: 10rem !important;
                }
                .table{
                    height: auto !important;
                    min-height: 0 !important;
                    max-height: none !important;
                    border-collapse: collapse !important;
                }
                .no-border{
                    border-bottom: none !important;
                }
                button {
                    display: none !important; /* hide buttons */
                }

                /* ✅ The screen-only "page card" look (border/shadow/fixed
                   size/gap) must disappear when printing, since the print
                   layout already handles page sizing via .print-container
                   and the @page rule above. Note: we deliberately do NOT
                   reset margin-left here, because .print-container relies
                   on margin-left: -23.5% (set above) to center the page —
                   resetting the full margin shorthand would break that. */
                .page-card {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    width: 100% !important;
                    min-height: 13.5in !important;
                    margin-top: 0 !important;
                    margin-right: 0 !important;
                    margin-bottom: 0 !important;
                }

            }
        `}
      </style>

      <TableContainer component={Paper} sx={{ width: "100%" }}>
        <Table>
          <TableHead
            sx={{
              backgroundColor: headerColor,
              border: `1px solid ${borderColor}`,
            }}
          >
            <TableRow>
              {/* Left cell: Student Number */}
              <TableCell
                sx={{
                  color: "white",
                  fontSize: "20px",
                  fontFamily: "Arial",
                  border: "none",
                }}
              >
                Student Number:&nbsp;
                <span
                  style={{
                    fontFamily: "Arial",
                    fontWeight: "normal",
                    textDecoration: "underline",
                  }}
                >
                  {studentData.student_number || "N/A"}
                </span>
              </TableCell>

              {/* Right cell: Student Name */}
              <TableCell
                align="right"
                sx={{
                  color: "white",
                  fontSize: "20px",
                  fontFamily: "Arial",
                  border: "none",
                }}
              >
                Student Name:&nbsp;
                <span
                  style={{
                    fontFamily: "Arial",
                    fontWeight: "normal",
                    textDecoration: "underline",
                  }}
                >
                  {formatStudentFullName(studentData)}
                </span>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          mb: 4,
        }}
      >
        <Box
          sx={{
            background: "white",
            border: `1px solid ${borderColor}`,

            width: "100%",
            p: 2,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <Typography
            sx={{
              fontWeight: "bold",
              color: titleColor,
              fontSize: "16px",
              mb: 2,
            }}
          >
            QUICK ACTIONS
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                sm: "repeat(3, 1fr)",
                md: "repeat(5, 1fr)",
              },
              gap: 2,
            }}
          >
            {TOR_EDIT_OPTIONS.map((option) => (
              <Box
                key={option.key}
                onClick={() => handleTorEditCardClick(option.key)}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  borderRadius: 2,
                  border: `1px solid ${option.color}`,
                  backgroundColor: option.bg,
                  color: option.color,
                  padding: "16px 10px",
                  minHeight: "110px",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    boxShadow: "0 6px 14px rgba(0,0,0,0.14)",
                  },
                }}
              >
                {option.icon}
                <Typography
                  sx={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    mt: 1,
                    lineHeight: 1.3,
                  }}
                >
                  {option.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "11px",
                    color: "text.secondary",
                    mt: 0.3,
                    lineHeight: 1.2,
                  }}
                >
                  {option.description}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <br />
      <br />

      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          width: "100%",
          mb: 4,
        }}
      >
        <Box
          sx={{
            background: "white",
            width: "100%",

          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
              px: 2,
              py: 1.5,
              backgroundColor: headerColor,
              color: "white",
              borderTop: `1px solid ${borderColor}`,
            }}
          >
            <Typography fontSize="14px" fontWeight="bold" color="white">
              Total Admin's Records: {signatures.length}
            </Typography>

            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Button
                onClick={() => setSignaturePage(0)}
                disabled={signaturePage === 0}
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
                  setSignaturePage((prev) => Math.max(prev - 1, 0))
                }
                disabled={signaturePage === 0}
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

              <FormControl size="small" sx={{ minWidth: 90 }}>
                <Select
                  value={signaturePage + 1}
                  onChange={(e) => setSignaturePage(Number(e.target.value) - 1)}
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
                      color: "white",
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 200,
                        backgroundColor: "#fff",
                      },
                    },
                  }}
                >
                  {Array.from({ length: totalSignaturePages }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      Page {i + 1}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography fontSize="11px" color="white">
                of {totalSignaturePages} page
                {totalSignaturePages > 1 ? "s" : ""}
              </Typography>

              <Button
                onClick={() =>
                  setSignaturePage((prev) =>
                    Math.min(prev + 1, totalSignaturePages - 1),
                  )
                }
                disabled={signaturePage >= totalSignaturePages - 1}
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
                onClick={() => setSignaturePage(totalSignaturePages - 1)}
                disabled={signaturePage >= totalSignaturePages - 1}
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
          <TableContainer
            component={Paper}
            elevation={2}
            sx={{
              overflowX: "auto",
              width: "100%",
              margin: "0 auto",
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["#", "Full Name", "Designation", "Prepared By", "Checked By", "Registrar", "Date of Graduation",].map((header) => (
                    <TableCell
                      key={header}
                      sx={{
                        border: `1px solid ${borderColor}`,
                        fontWeight: 600,
                        color: titleColor,
                        textAlign: "center",
                        fontSize: "13px",
                        padding: "6px 10px", // smaller height
                      }}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedSignatures.map((signature, index) => (
                  <TableRow key={signature.id}>
                    <TableCell
                      sx={{
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                        fontSize: "12px",
                        color: titleColor,
                        padding: "4px 8px",
                      }}
                    >
                      {signaturePage * SIGNATURES_PER_PAGE + index + 1}
                    </TableCell>

                    <TableCell
                      sx={{
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                        fontSize: "12px",
                        color: titleColor,
                        padding: "4px 8px",
                      }}
                    >
                      {signature.full_name}
                    </TableCell>

                    <TableCell
                      sx={{
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                        color: titleColor,
                        fontSize: "12px",
                        padding: "4px 8px",
                      }}
                    >
                      {signature.designation}
                    </TableCell>

                    <TableCell
                      sx={{
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                        color: titleColor,
                        padding: "4px 6px",
                      }}
                    >
                      <Checkbox
                        size="small"
                        color="primary"
                        checked={selectedPreparedBy?.id === signature.id}
                        onChange={() => handlePreparedByChange(signature)}
                        disabled={isSignatureSelectedForAnotherRole(signature, "prepared")}
                      />
                    </TableCell>

                    <TableCell
                      sx={{
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                        color: titleColor,
                        padding: "4px 6px",
                      }}
                    >
                      <Checkbox
                        size="small"
                        color="secondary"
                        checked={selectedCheckedBy?.id === signature.id}
                        onChange={() => handleCheckedByChange(signature)}
                        disabled={isSignatureSelectedForAnotherRole(signature, "checked")}
                      />
                    </TableCell>

                    <TableCell
                      sx={{
                        border: `1px solid ${borderColor}`,
                        textAlign: "center",
                        color: titleColor,
                        padding: "4px 6px",
                      }}
                    >
                      <Checkbox
                        size="small"
                        color="success"
                        checked={selectedRegistrar?.id === signature.id}
                        onChange={() => handleRegistrarChange(signature)}
                        disabled={isSignatureSelectedForAnotherRole(signature, "registrar")}
                      />
                    </TableCell>

                    {/* Global, page-level control — rendered once and vertically
                        centered across every row via rowSpan, not per signature */}
                    {index === 0 && (
                      <TableCell
                        rowSpan={paginatedSignatures.length}
                        sx={{
                          border: `1px solid ${borderColor}`,
                          textAlign: "center",
                          verticalAlign: "middle",
                          color: titleColor,
                          padding: "4px 6px",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            width: "100%",
                          }}
                        >
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <Box sx={{ width: 190 }}>
                              <DateField
                                label="Date of Graduation"
                                value={graduationDate}
                                onChange={handleGraduationDateChange}
                                slotProps={{ textField: { size: "small", fullWidth: true } }}
                              />
                            </Box>
                          </LocalizationProvider>
                        </Box>
                      </TableCell>
                    )}


                  </TableRow>
                ))}

                {paginatedSignatures.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      align="center"
                      sx={{
                        border: `1px solid ${borderColor}`,
                        color: titleColor,
                        padding: "8px",
                        fontSize: "12px",
                      }}
                    >
                      No signatures found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
              px: 2,
              py: 1.5,
              backgroundColor: headerColor,
              color: "white",
              borderTop: `1px solid ${borderColor}`,
            }}
          >
            <Typography fontSize="14px" fontWeight="bold" color="white">
              Total Admin's Records: {signatures.length}
            </Typography>

            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Button
                onClick={() => setSignaturePage(0)}
                disabled={signaturePage === 0}
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
                  setSignaturePage((prev) => Math.max(prev - 1, 0))
                }
                disabled={signaturePage === 0}
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

              <FormControl size="small" sx={{ minWidth: 90 }}>
                <Select
                  value={signaturePage + 1}
                  onChange={(e) => setSignaturePage(Number(e.target.value) - 1)}
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
                      color: "white",
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 200,
                        backgroundColor: "#fff",
                      },
                    },
                  }}
                >
                  {Array.from({ length: totalSignaturePages }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      Page {i + 1}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography fontSize="11px" color="white">
                of {totalSignaturePages} page
                {totalSignaturePages > 1 ? "s" : ""}
              </Typography>

              <Button
                onClick={() =>
                  setSignaturePage((prev) =>
                    Math.min(prev + 1, totalSignaturePages - 1),
                  )
                }
                disabled={signaturePage >= totalSignaturePages - 1}
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
                onClick={() => setSignaturePage(totalSignaturePages - 1)}
                disabled={signaturePage >= totalSignaturePages - 1}
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
        </Box>



      </Box>



      <Box
        style={{ width: "100%", display: "flex", justifyContent: "center" }}
        className="page-container"
      >
        <Box
          ref={divToPrintRef}
          className="page"
          style={{ minWidth: "215.9mm" }}
        >
          {paginatedSubjects.map((pageGroups, pageIndex) => (
            <Box
              key={pageIndex}
              className={`print-container print-container-${pageIndex + 1} page-card`}
              style={{
                pageBreakAfter: "always",
                breakAfter: "page",
                paddingRight: "3.5rem",
                marginTop: "3rem",
                paddingBottom: "1.5rem",
                position: "relative",
              }}
            >
              {/* ACT / UKAS / IAF accreditation logos — top right corner */}
              <Box
                style={{
                  position: "absolute",
                  top: 0,
                  right: "5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: 2,
                  marginTop: "50px"
                }}
              >
                <Box style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <img src={Act} alt="ACT" style={{ width: "50px", height: "50px", objectFit: "contain" }} />
                  <img src={Ukas} alt="UKAS" style={{ width: "50px", height: "50px", objectFit: "contain" }} />
                  <img src={Iaf} alt="IAF" style={{ width: "50px", height: "50px", objectFit: "contain" }} />
                </Box>
                <Typography
                  style={{
                    fontSize: "11px",
                    textAlign: "center",
                    marginTop: "20px",
                    lineHeight: 1.2,
                    fontFamily: "Arial",
                  }}
                >
                  {(shortTerm || "").toUpperCase()} FORM NO. I-A
                  <br />
                  REVISED 2025
                </Typography>
              </Box>
              {/* Start Of Header */}
              <Box
                className="page-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "10rem",
                  width: "80rem",
                  justifyContent: "center",
                }}
              >
                <Box
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    paddingTop: "1.5rem",
                    marginLeft: "-10rem",
                    paddingRight: "3rem",
                  }}
                >
                  <img
                    src={BagongPilipinasLogo}
                    alt="Bagong Pilipinas"
                    style={{ width: "130px", height: "120px" }}
                  />
                  <img
                    src={fetchedLogo || EaristLogo} // use dynamic logo if available
                    alt="Logo"
                    style={{
                      width: "120px",
                      height: "120px",
                      borderRadius: "50%",
                    }}
                  />
                </Box>
                <Box style={{ marginTop: "1.5rem", textAlign: "center" }}>
                  <div style={{ fontFamily: "Arial", fontSize: "13px" }}>
                    Republic of the Philippines
                  </div>

                  {companyName &&
                    (() => {
                      const words = companyName.trim().split(" ");
                      const middle = Math.ceil(words.length / 2);
                      const firstLine = words.slice(0, middle).join(" ");
                      const secondLine = words.slice(middle).join(" ");
                      return (
                        <>
                          <Typography
                            style={{
                              marginTop: "0rem",
                              lineHeight: "1",
                              fontSize: "1.6rem",
                              letterSpacing: "-1px",
                              fontWeight: "600",
                              fontFamily: "Arial",
                              textTransform: "uppercase"
                            }}
                          >
                            {firstLine}
                          </Typography>
                          {secondLine && (
                            <Typography
                              style={{
                                lineHeight: "1",
                                fontSize: "1.6rem",
                                letterSpacing: "-1px",
                                fontWeight: "600",
                                fontFamily: "Arial",
                                textTransform: "uppercase"
                              }}
                            >
                              {secondLine}
                            </Typography>
                          )}
                        </>
                      );
                    })()}

                  <Typography style={{ fontFamily: "Arial", fontSize: "13px", fontWeight: "bold" }}>
                    {allBranchNames}
                  </Typography>
                </Box>
              </Box>
              <Typography
                style={{
                  height: "1.5rem",
                  marginLeft: "1rem",
                  textAlign: "center",
                  width: "80rem",
                  fontSize: "1.6rem",
                  letterSpacing: "-1px",
                  fontWeight: "500",
                }}
              >
                OFFICE OF THE REGISTRAR
              </Typography>
              <Typography
                style={{
                  height: "2.5rem",
                  marginLeft: "1rem",
                  marginTop: "-0.5rem",
                  width: "80rem",
                  textAlign: "center",
                  fontSize: "2.75rem",
                  letterSpacing: "-1px",
                  fontWeight: "600",
                }}
              >
                OFFICIAL TRANSCRIPT OF RECORDS
              </Typography>
              <Box style={{ display: "flex", marginTop: "1rem" }}>
                <Box>
                  <Box
                    style={{
                      display: "flex",
                      height: "17.5rem",
                      marginLeft: "1rem",
                      width: "80rem",
                      borderBottom: "solid black 1px",
                    }}
                  >
                    <Box
                      sx={{
                        padding: "1rem",
                        width: "80rem",
                      }}
                    >
                      <Box>
                        <Box style={{ display: "flex", width: "70rem" }}>
                          <Typography
                            style={{
                              width: "20rem",
                              fontSize: "22px",
                              letterSpacing: "-2px",
                              wordSpacing: "14rem",
                            }}
                          >
                            NAME :
                          </Typography>

                          <Typography
                            style={{
                              display: "flex",
                              fontSize: "24px",
                              fontWeight: "600",
                              letterSpacing: "-1.5px",
                              wordSpacing: "3px",
                              alignItems: "center",
                              height: "36px",
                            }}
                          >
                            {formatStudentFullName(studentData)}
                          </Typography>
                        </Box>
                        <Box style={{ display: "flex", marginTop: "-6px" }}>
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "20px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-1px",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>DATE OF BIRTH</span>
                            <span>:</span>
                          </Typography>
                          <Typography
                            style={{
                              fontSize: "21px",
                              marginTop: "-5px",
                              marginLeft: "2.3rem",
                              fontWeight: "400",
                              letterSpacing: "-1px",
                              wordSpacing: "3px",
                            }}
                          >
                            {formattedDate(studentData.birthOfDate)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Box
                          style={{
                            display: "flex",
                            width: "62rem",
                            marginTop: "0.6rem",
                          }}
                        >
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "20px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-2.3px",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>ADMISSION CREDENTIALS</span>
                            <span>:</span>
                          </Typography>
                          {studentData && studentData.requirements && (
                            <Typography
                              style={{
                                fontSize: "21px",
                                marginTop: "-5px",
                                height: "30px",
                                marginLeft: "2.3rem",
                                fontWeight: "400",
                                letterSpacing: "-2px",
                                wordSpacing: "1px",
                              }}
                            >
                              {admissionCredentialsNote}
                            </Typography>
                          )}
                        </Box>
                        <Box style={{ display: "flex", marginTop: "-1px" }}>
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "20px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-2.3px",
                              justifyContent: "space-between",
                            }}
                          >
                            <span style={{ wordSpacing: "2px" }}>
                              LAST SCHOOL ATTENDED
                            </span>
                            <span>:</span>
                          </Typography>
                          <Typography
                            style={{
                              fontSize: "22px",
                              marginTop: "-5px",
                              marginLeft: "2.3rem",
                              fontWeight: "400",
                              letterSpacing: "-1.5px",
                              wordSpacing: "5px",
                            }}
                          >
                            {studentData.schoolLastAttended1}
                          </Typography>
                        </Box>
                        <Box style={{ display: "flex", marginTop: "-3px" }}>
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "30px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-2.3px",
                              justifyContent: "space-between",
                            }}
                          >
                            <span style={{ wordSpacing: "3px" }}>
                              DATE GRADUATED
                            </span>
                            <span>:</span>
                          </Typography>
                          <Typography
                            style={{
                              fontSize: "22px",
                              marginTop: "-5px",
                              marginLeft: "2.3rem",
                              fontWeight: "400",
                              letterSpacing: "-1.5px",
                              wordSpacing: "5px",
                            }}
                          >

                            {formatYearGraduatedRange(studentData.yearGraduated1)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Box
                          style={{
                            display: "flex",
                            width: "38rem",
                            marginTop: "0.9rem",
                          }}
                        >
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "20px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-1px",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>STUDENT NUMBER</span>
                            <span>:</span>
                          </Typography>

                          <Typography
                            style={{
                              fontSize: "21px",
                              marginTop: "-5px",
                              marginLeft: "2.3rem",
                              fontWeight: "500",
                              letterSpacing: "-1px",
                              wordSpacing: "3px",
                              height: "30px",
                            }}
                          >
                            {studentData.student_number}
                          </Typography>
                        </Box>
                        <Box style={{ display: "flex" }}>
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "20px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-1px",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>DEGREE/TITLE EARNED</span>
                            <span>:</span>
                          </Typography>
                          <Typography
                            style={{
                              fontSize: "22px",
                              marginLeft: "2.3rem",
                              marginTop: "-5.5px",
                              fontWeight: "500",
                              letterSpacing: "-1.5px",
                              wordSpacing: "5px",
                              height: "30px",
                            }}
                          >
                            {studentData && studentData.program_description
                              ? `${studentData.program_description?.toUpperCase()}`
                              : ""}
                          </Typography>
                        </Box>
                        <Box style={{ display: "flex", marginTop: "1px" }}>
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "20px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-1.5px",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>MAJOR</span>
                            <span>:</span>
                          </Typography>
                          <Typography
                            style={{
                              fontSize: "22px",
                              marginTop: "-5px",
                              marginLeft: "2.3rem",
                              fontWeight: "500",
                              letterSpacing: "-1.5px",
                              wordSpacing: "5px",
                              height: "30px",
                            }}
                          >
                            {studentData && studentData.major
                              ? `${studentData.major?.toUpperCase()}`
                              : ""}
                          </Typography>
                        </Box>
                        <Box style={{ display: "flex", marginTop: "1px" }}>
                          <Typography
                            style={{
                              display: "flex",
                              width: "17.8rem",
                              height: "20px",
                              alignItems: "center",
                              fontSize: "22px",
                              letterSpacing: "-2px",
                              justifyContent: "space-between",
                              wordSpacing: "4px",
                            }}
                          >
                            <span>DATE OF GRADUATION</span>
                            <span>:</span>
                          </Typography>
                          <Typography
                            style={{
                              fontSize: "22px",
                              marginTop: "-5px",
                              marginLeft: "2.3rem",
                              fontWeight: "500",
                              letterSpacing: "-1.5px",
                              wordSpacing: "5px",
                            }}
                          >
                            {formattedGraduationDate}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    <Box
                      style={{ marginLeft: "-12.6rem", marginTop: "1.3rem" }}
                    >
                      {!studentData?.profile_image ? (
                        <Avatar
                          sx={{
                            width: 225,
                            height: 225,
                            mx: "auto",
                            border: "1px solid black",
                            color: "maroon",
                            bgcolor: "transparent",
                          }}
                          variant="square"
                        />
                      ) : (
                        <Avatar
                          src={`${API_BASE_URL}/uploads/Student1by1/${studentData.profile_image}`}
                          sx={{
                            width: 225,
                            height: 225,
                            mx: "auto",
                            border: "1px solid black"
                          }}
                          variant="square"
                        />
                      )}
                    </Box>
                  </Box>
                  {/* End of Header */}
                  {/* Start of Main Content */}
                  <Box
                    style={{
                      display: "flex",
                      marginLeft: "1rem",
                      marginTop: "0.5rem",
                      flexWrap: "wrap",
                      width: "80rem",
                      borderTop: "solid black 1px",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      style={{
                        flex: "0 0 50%",
                        marginBottom: "1rem",
                        boxSizing: "border-box",
                      }}
                    >
                      <table
                        className="table"
                        style={{
                          height: "auto",
                          minHeight: 0,
                          borderCollapse: "collapse",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              display: "flex",
                              height: "65px",
                              borderBottom: "solid 1px black",
                            }}
                          >
                            <td
                              style={{
                                fontWeight: "600",
                                fontSize: "20px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                letterSpacing: "0.8px",
                                width: "13rem",
                              }}
                            >
                              <span>TERM</span>
                            </td>
                            <td
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "38rem",
                              }}
                            >
                              <div
                                style={{
                                  margin: "-1px",
                                  fontWeight: "600",
                                  fontSize: "20px",
                                  textAlign: "center",
                                  letterSpacing: "-1px",
                                  width: "28rem",
                                }}
                              >
                                SUBJECTS
                              </div>
                              <div
                                style={{
                                  margin: "-1px",
                                  fontWeight: "600",
                                  fontSize: "20px",
                                  textAlign: "center",
                                  letterSpacing: "-1px",
                                  width: "28rem",
                                  wordSpacing: "3px",
                                }}
                              >
                                CODE NUMBER WITH DESCRIPTIVE TITLE
                              </div>
                            </td>
                            <td>
                              <div
                                style={{
                                  fontWeight: "600",
                                  textAlign: "center",
                                  fontSize: "20px",
                                  letterSpacing: "-1px",
                                  width: "13rem",
                                }}
                              >
                                <span style={{ marginLeft: "-1.6rem" }}>
                                  GRADES
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: "600",
                                    fontSize: "20px",
                                    textAlign: "center",
                                    letterSpacing: "-1px",
                                    width: "6rem",
                                  }}
                                >
                                  <span>FINAL</span>
                                </div>
                                <div
                                  style={{
                                    textAlign: "center",
                                    fontWeight: "600",
                                    fontSize: "20px",
                                    marginLeft: "-2rem",
                                    letterSpacing: "-1px",
                                    width: "7rem",
                                  }}
                                >
                                  <span>RE-EXAM</span>
                                </div>
                              </div>
                            </td>
                            <td
                              style={{
                                fontWeight: "600",
                                display: "flex",
                                fontSize: "20px",
                                alignItems: "center",
                                justifyContent: "center",
                                letterSpacing: "-1px",
                                width: "7rem",
                              }}
                            >
                              <span>CREDITS</span>
                            </td>
                            <td
                              style={{
                                fontWeight: "600",
                                display: "flex",
                                fontSize: "20px",
                                alignItems: "center",
                                justifyContent: "center",
                                letterSpacing: "-1px",
                                width: "8.9rem",
                              }}
                            >
                              <span>REMARKS</span>
                            </td>
                          </tr>
                        </thead>
                        <tbody
                          style={{ maxWidth: "650px", overflowY: "hidden" }}
                        >
                          <tr>
                            <td
                              style={{
                                fontWeight: "500",
                                textUnderlineOffset: "3px",
                                textDecoration: "underline",
                                letterSpacing: "-1px",
                                paddingLeft: "1.5rem",
                                fontSize: "20px",
                              }}
                            >
                              {studentData && studentData.program_description
                                ? `${studentData.program_description?.toUpperCase()}`
                                : ""}
                            </td>
                          </tr>

                          {pageGroups.map((group, groupIndex) => {
                            const compactTermLabel =
                              pageIndex === paginatedSubjects.length - 1 &&
                              groupIndex === pageGroups.length - 1 &&
                              group.subjects.length <= 6;

                            return (
                              <React.Fragment key={group.termKey}>
                                {group.subjects.map((p, index) => {
                                  const isCompactTermRow =
                                    compactTermLabel && index === 0;

                                  return (
                                    <tr
                                      style={{
                                        display: "flex",
                                        alignItems: isCompactTermRow
                                          ? "center"
                                          : "flex-start",
                                        lineHeight: "22px",
                                        minHeight: isCompactTermRow
                                          ? "38px"
                                          : "22px",
                                      }}
                                      key={p.enrolled_id}
                                    >
                                      <td
                                        style={{
                                          width: "13rem",
                                          fontWeight: "400",
                                          display: "flex",
                                          flexDirection: "column",
                                          justifyContent: compactTermLabel
                                            ? "center"
                                            : "center",
                                          alignItems: "flex-start",
                                          position: "relative",
                                          lineHeight: compactTermLabel ? "18px" : "22px",
                                          paddingTop: index === 0 ? "0" : "0",
                                        }}
                                      >
                                        {!group.isContinuation && index === 0 && (
                                          <>
                                            <span
                                              style={{
                                                fontSize: compactTermLabel
                                                  ? "17px"
                                                  : "18px",
                                                textAlign: "center",
                                                width: "14rem",
                                                fontWeight: "500",
                                                lineHeight: compactTermLabel ? "18px" : "22px",
                                              }}
                                            >
                                              {convertSemester(p)}
                                            </span>
                                            <span
                                              style={{
                                                fontSize: compactTermLabel
                                                  ? "16px"
                                                  : "17px",
                                                marginTop: compactTermLabel ? 0 : "3rem",
                                                position: compactTermLabel
                                                  ? "static"
                                                  : "absolute",
                                                textAlign: "center",
                                                width: "13.5rem",
                                                fontWeight: "500",
                                                lineHeight: compactTermLabel ? "18px" : "22px",
                                              }}
                                            >
                                              {p.current_year} - {p.next_year}
                                            </span>
                                          </>
                                        )}
                                      </td>
                                      <td
                                        style={{
                                          display: "flex",
                                          alignItems: isCompactTermRow
                                            ? "center"
                                            : "flex-start",
                                          width: "38rem",
                                          lineHeight: "22px",
                                          padding: 0,
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: "9.5rem",
                                            flex: "0 0 9.5rem",
                                            margin: "0",
                                            padding: "0",
                                            fontSize: "18px",
                                            lineHeight: "22px",
                                            letterSpacing: "-0.5px",
                                            whiteSpace: "normal",
                                          }}
                                        >
                                          {p.course_code}
                                        </span>
                                        <span
                                          style={{
                                            flex: "1 1 auto",
                                            marginLeft: 0,
                                            padding: "0",
                                            fontSize: "18px",
                                            lineHeight: "22px",
                                            letterSpacing: "-0.5px",
                                          }}
                                        >
                                          {p.course_description
                                            ? p.course_description?.toUpperCase()
                                            : ""}
                                          &nbsp;
                                          {p.component === 1
                                            ? "CWTS"
                                            : p.component === 2
                                              ? "LTS"
                                              : p.component === 3
                                                ? "MTS"
                                                : ""}
                                        </span>
                                      </td>
                                      <td>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            minHeight: isCompactTermRow
                                              ? "38px"
                                              : "22px",
                                            lineHeight: "22px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: "18px",
                                              width: "6rem",
                                              textAlign: "center",
                                              lineHeight: "22px",
                                            }}
                                          >
                                            <span>
                                              {handleGradeConversion(
                                                p.final_grade || p.numeric_grade,
                                              )}
                                            </span>
                                          </div>
                                          <div
                                            style={{
                                              fontSize: "18px",
                                              textAlign: "center",
                                              width: "7rem",
                                              marginLeft: "-2rem",
                                              lineHeight: "22px",
                                            }}
                                          >
                                            <span></span>
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        <div
                                          style={{
                                            display: "flex",
                                            fontSize: "18px",
                                            alignItems: "center",
                                            minHeight: isCompactTermRow
                                              ? "38px"
                                              : "22px",
                                            width: "7rem",
                                            marginLeft: "1.7rem",
                                            justifyContent: "center",
                                            lineHeight: "22px",
                                          }}
                                        >
                                          {totalUnitPerSubject(
                                            p.course_unit,
                                            p.lab_unit,
                                          )}
                                        </div>
                                      </td>
                                      <td>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            minHeight: isCompactTermRow
                                              ? "38px"
                                              : "22px",
                                            width: "8.9rem",
                                            fontSize: "18px",
                                            justifyContent: "center",
                                            lineHeight: "22px",
                                          }}
                                        >
                                          {p.en_remarks === 0
                                            ? "Ongoing"
                                            : p.en_remarks === 1
                                              ? "Passed"
                                              : p.en_remarks === 2
                                                ? "Failed"
                                                : p.en_remarks === 3
                                                  ? "Incomplete"
                                                  : p.en_remarks === 4
                                                    ? "Dropped"
                                                    : ""}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}

                          <tr
                            style={{
                              display: "flex",
                              height: "auto",
                              lineHeight: 1,
                            }}
                          >
                            {pageIndex === paginatedSubjects.length - 1 ? (
                              <td
                                className="table-cell-padding"
                                style={{
                                  textAlign: "center",
                                  width: "79.9rem",
                                  padding: "1px 0 0",
                                  lineHeight: 1,
                                }}
                              >
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "17px",
                                    fontWeight: "600",
                                    lineHeight: 1.3,
                                    whiteSpace: "normal",
                                    width: "100%",
                                    overflow: "visible",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  <span style={{ fontSize: "14px", marginRight: "2px" }}>
                                    {repeatShortTermWithSpaces(shortTerm)} xxx{" "}
                                  </span>
                                  NOTHING FOLLOWS
                                  <span style={{ fontSize: "14px", marginLeft: "2px" }}>
                                    {" "}
                                    xxx {repeatShortTermWithSpaces(shortTerm)}
                                  </span>
                                </span>
                              </td>
                            ) : (
                              <td
                                style={{
                                  textAlign: "center",
                                  borderTop: "dashed 1px black",
                                  width: "79.9rem",
                                  padding: "1px 0 0",
                                  lineHeight: 1,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "17px",
                                    fontWeight: "600",
                                  }}
                                >
                                  - continued on next page -
                                </span>
                              </td>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </Box>
                  </Box>
                  {/* End of Main Content */}
                  {/* Start Of Footer */}
                  <Box
                    className="page-footer"
                    style={{
                      display: "flex",
                      marginLeft: "1rem",
                      marginTop: "-1rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <Box
                      style={{
                        flex: "0 0 50%",
                        marginBottom: "1rem",
                        boxSizing: "border-box",
                      }}
                    >
                      <table>
                        <thead>
                          <tr
                            className="grading_sytse_tble"
                            style={{
                              display: "flex",
                              height: "145px",
                              borderTop: "solid 1px black",
                            }}
                          >
                            <td
                              style={{
                                fontWeight: "400",
                                fontSize: "18px",
                                display: "flex",
                                alignItems: "start",
                                justifyContent: "center",
                                letterSpacing: "-1px",
                                width: "13rem",
                              }}
                            >
                              <span>GRADING SYSTEM</span>
                            </td>
                            <td style={{ display: "flex", flexDirection: "column", alignItems: "start", width: "4.5rem" }}>
                              {gradingSystemFirstHalf.map((row, i) => (
                                <div
                                  key={`gs-grade-1-${row.id}`}
                                  style={{ margin: "-1px", fontWeight: "400", fontSize: "16px", letterSpacing: "0px", paddingTop: i === 0 ? "3px" : 0 }}
                                >
                                  {row.equivalent_grade}
                                </div>
                              ))}
                            </td>
                            <td style={{ display: "flex", flexDirection: "column", alignItems: "start", width: "6.5rem" }}>
                              {gradingSystemFirstHalf.map((row, i) => (
                                <div
                                  key={`gs-score-1-${row.id}`}
                                  style={{ margin: "-1px", fontWeight: "400", fontSize: "16px", letterSpacing: "-2px", paddingTop: i === 0 ? "3px" : 0 }}
                                >
                                  ({row.min_score}-{row.max_score})
                                </div>
                              ))}
                            </td>
                            <td style={{ display: "flex", flexDirection: "column", alignItems: "start", width: "15.5rem" }}>
                              {gradingSystemFirstHalf.map((row, i) => (
                                <div
                                  key={`gs-desc-1-${row.id}`}
                                  style={{ margin: "-1px", fontWeight: "400", fontSize: "16px", letterSpacing: "-1px", paddingTop: i === 0 ? "3px" : 0 }}
                                >
                                  {row.description}
                                </div>
                              ))}
                            </td>
                            <td style={{ display: "flex", flexDirection: "column", alignItems: "start", width: "4.5rem" }}>
                              {gradingSystemSecondHalf.map((row, i) => (
                                <div
                                  key={`gs-grade-2-${row.id}`}
                                  style={{ margin: "-1px", fontWeight: "400", fontSize: "16px", letterSpacing: "-1px", paddingTop: i === 0 ? "3px" : 0 }}
                                >
                                  {row.equivalent_grade}
                                </div>
                              ))}
                            </td>
                            <td style={{ display: "flex", flexDirection: "column", alignItems: "start", width: "14rem" }}>
                              {gradingSystemSecondHalf.map((row, i) => (
                                <div
                                  key={`gs-score-2-${row.id}`}
                                  style={{ margin: "-1px", fontWeight: "400", fontSize: "16px", letterSpacing: "-2px", paddingTop: i === 0 ? "3px" : 0 }}
                                >
                                  ({row.min_score}-{row.max_score})
                                </div>
                              ))}
                            </td>
                            <td style={{ display: "flex", flexDirection: "column", alignItems: "start", width: "22rem" }}>
                              {gradingSystemSecondHalf.map((row, i) => (
                                <div
                                  key={`gs-desc-2-${row.id}`}
                                  style={{ margin: "-1px", fontWeight: "400", fontSize: "16px", letterSpacing: "-1px", paddingTop: i === 0 ? "3px" : 0 }}
                                >
                                  {row.description}
                                </div>
                              ))}
                            </td>
                          </tr>
                          <tr
                            style={{
                              display: "flex",
                              paddingLeft: "2rem",
                              height: "35px",
                              borderBottom: "solid 1px black",
                            }}
                          >
                            <td>
                              <span style={{ fontSize: "18px" }}>
                                CREDITS, O
                              </span>
                              <span>
                                ne college units is at least (17) full hours of
                                instruction in academic or professional subject
                                within a semester.
                              </span>
                            </td>
                          </tr>
                          <tr
                            style={{
                              display: "flex",
                              paddingLeft: "2rem",
                              height: "65px",
                              borderBottom: "solid 1px black",
                            }}
                          >
                            <td style={{ marginTop: "8px" }}>
                              <span
                                style={{
                                  fontSize: "18px",
                                  marginRight: "8px",
                                  letterSpacing: "-0.8px",
                                  wordSpacing: "1px",
                                }}
                              >
                                {companyName?.toUpperCase()}
                              </span>
                              <span
                                style={{
                                  letterSpacing: "-0.8px",
                                  fontSize: "17px",
                                  wordSpacing: "1px",
                                }}
                              >
                                is a State College; hence, a SPECIAL ORDER is
                                not issued to its graduates. The <br />
                                issuance of the Official Transcript of Records
                                and Diploma is a sufficient proof for
                                Graduation.
                              </span>
                            </td>
                          </tr>
                          <tr
                            style={{
                              display: "flex",
                              paddingLeft: "1rem",
                              marginTop: "0.3rem",
                              height: "65px",
                              borderTop: "solid 1px black",
                              borderBottom: "solid 1px black",
                              alignItems: "center",
                            }}
                          >
                            <td style={{ marginTop: "8px" }}>
                              <span
                                style={{
                                  fontSize: "18px",
                                  fontWeight: "600",
                                  marginRight: "8px",
                                  letterSpacing: "-0.8px",
                                  wordSpacing: "1px",
                                }}
                              >
                                REMARKS:
                              </span>
                              <span style={{ fontSize: "18px", fontWeight: "400", letterSpacing: "-0.5px" }}>
                                {getPageRemarksText(
                                  pageIndex === paginatedSubjects.length - 1,
                                  studentData?.program_description
                                    ? studentData.program_description.toUpperCase()
                                    : "",
                                )}
                              </span>
                            </td>
                          </tr>
                          <tr
                            style={{
                              display: "flex",
                              paddingLeft: "1rem",
                              marginTop: "0.3rem",
                              height: "35px",
                            }}
                          >
                            <td style={{ marginTop: "3px" }}>
                              <span
                                style={{
                                  fontSize: "18px",
                                  fontWeight: "400",
                                  marginRight: "2.4rem",
                                  letterSpacing: "-0.8px",
                                  wordSpacing: "1px",
                                }}
                              >
                                DATE ISSUED:
                              </span>
                              <span
                                style={{
                                  fontSize: "18px",
                                  letterSpacing: "-1px",
                                  wordSpacing: "3px",
                                }}
                              >
                                {dateIssuedDisplay}
                              </span>
                            </td>
                          </tr>
                          <tr
                            className="no-border"
                            style={{
                              display: "flex",
                              paddingLeft: "1rem",
                              marginTop: "0.3rem",
                              height: "9rem",
                              borderBottom: "solid black 1px",
                            }}
                          >
                            <td style={{ marginTop: "3px", width: "17rem" }}>
                              <div>
                                <span
                                  style={{
                                    fontSize: "18px",
                                    letterSpacing: "-1px",
                                    wordSpacing: "3px",
                                  }}
                                ></span>
                                <span></span>
                              </div>
                            </td>
                            <td style={{ marginTop: "3px", width: "20rem" }}>
                              <span
                                style={{
                                  fontSize: "18px",
                                  fontWeight: "400",
                                  marginRight: "2.4rem",
                                  letterSpacing: "-0.8px",
                                  wordSpacing: "1px",
                                }}
                              >
                                PREPARED BY:
                              </span>
                              <div style={{ marginTop: "0.4rem", textAlign: "left" }}>
                                {selectedPreparedBy?.signature_image && (
                                  <img
                                    src={getSignatureImageSrc(selectedPreparedBy)}
                                    alt={selectedPreparedBy.signature_name || "Prepared by signature"}
                                    style={{
                                      width: "11rem",
                                      height: "2.7rem",
                                      objectFit: "contain",
                                      display: "block",
                                      margin: "0 0 -0.2rem",
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "20px",
                                    fontWeight: "500",
                                    letterSpacing: "-1px",
                                    wordSpacing: "3px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {selectedPreparedBy?.full_name?.toUpperCase() || ""}
                                </span>
                              </div>
                            </td>
                            <td style={{ marginTop: "3px", width: "20rem" }}>
                              <span
                                style={{
                                  fontSize: "18px",
                                  fontWeight: "400",
                                  marginRight: "2.4rem",
                                  letterSpacing: "-0.8px",
                                  wordSpacing: "1px",
                                }}
                              >
                                CHECKED BY:
                              </span>
                              <div style={{ marginTop: "0.4rem", textAlign: "left" }}>
                                {selectedCheckedBy?.signature_image && (
                                  <img
                                    src={getSignatureImageSrc(selectedCheckedBy)}
                                    alt={selectedCheckedBy.signature_name || "Checked by signature"}
                                    style={{
                                      width: "11rem",
                                      height: "2.7rem",
                                      objectFit: "contain",
                                      display: "block",
                                      margin: "0 0 -0.2rem",
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "20px",
                                    fontWeight: "500",
                                    letterSpacing: "-1px",
                                    wordSpacing: "3px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {selectedCheckedBy?.full_name?.toUpperCase() || ""}
                                </span>
                              </div>
                            </td>
                            <td
                              style={{
                                marginTop: "-3px",
                                width: "21rem",
                                justifyContent: "center",
                                alignContent: "center",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  textAlign: "center",
                                }}
                              >
                                {selectedRegistrar?.signature_image && (
                                  <img
                                    src={getSignatureImageSrc(selectedRegistrar)}
                                    alt={selectedRegistrar.signature_name || "Registrar signature"}
                                    style={{
                                      width: "11rem",
                                      height: "2.7rem",
                                      objectFit: "contain",
                                      display: "block",
                                      margin: "0 auto -0.2rem",
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    fontSize: "24px",
                                    letterSpacing: "-2px",
                                    wordSpacing: "3px",
                                  }}
                                >
                                  {selectedRegistrar?.full_name?.toUpperCase() || ""}
                                </span>
                                <hr />
                                <span
                                  style={{
                                    fontSize: "18px",
                                    letterSpacing: "-1px",
                                    wordSpacing: "3px",
                                  }}
                                >REGISTRAR
                                </span>
                              </div>
                            </td>
                          </tr>
                        </thead>
                      </table>
                    </Box>
                  </Box>

                </Box>
              </Box>


              <Box
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: ".2rem",
                }}
              >
                {branches
                  .filter((b) => b?.address || b?.branch_address || b?.campus_address)
                  .map((b, index, arr) => (
                    <Typography
                      key={b.id ?? b.branch}
                      style={{
                        fontSize: "14px",
                        textAlign: "center",
                        letterSpacing: "-0.3px",
                        lineHeight: 1.3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>
                        {(b.branch || b.branch_name || "").toUpperCase()}:
                      </span>{" "}
                      {b.address || b.branch_address || b.campus_address}
                      {index < arr.length - 1 && (
                        <span style={{ margin: "0 0.75rem", fontWeight: 400 }}>|</span>
                      )}
                    </Typography>
                  ))}
              </Box>

            </Box>
          ))}


        </Box>
      </Box>

      <PhotoCaptureDialog
        open={photoCaptureOpen}
        onClose={() => setPhotoCaptureOpen(false)}
        personId={studentData?.person_id}
        onUploaded={(filename) => {
          setStudentData((prev) => ({ ...prev, profile_image: filename }));
          setSnackbarMessage("Student photo updated successfully.");
          setOpenSnackbar(true);
        }}
      />

      <Dialog open={remarksDialogOpen} onClose={closeRemarksDialog} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            bgcolor: mainButtonColor || "#1976d2",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          📝 Edit Remarks
          <IconButton
            onClick={closeRemarksDialog}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "50%",
              width: 40,
              height: 40,
              padding: 0,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.2)", border: "2px solid white" },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This text appears in the REMARKS field on every page of the Transcript
            of Records, except the last page — which automatically shows the
            graduation remark based on the Date of Graduation you set above.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Remarks"
            value={remarksDraft}
            onChange={(e) => setRemarksDraft(e.target.value)}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
          <Button onClick={closeRemarksDialog} color="error" variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSaveRemarks} variant="contained" color="success">
            Save Remarks
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={gradingSystemDialogOpen}
        onClose={closeGradingSystemDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: "#2e7d32",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          📊 Edit Grading System
          <IconButton
            onClick={closeGradingSystemDialog}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "50%",
              width: 40,
              height: 40,
              padding: 0,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.2)", border: "2px solid white" },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Check the grade conversion rows that should appear in the GRADING SYSTEM
            block printed on every page of the Transcript of Records. To add or edit
            a row itself, use Admin → Grade Conversion.
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: "10%" }} align="center">Show</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: "18%" }}>Grade</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: "27%" }}>Score Range</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: "45%" }}>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gradingSystemDraft.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell align="center">
                      <Checkbox
                        checked={!!row.show_on_tor}
                        onChange={() => handleToggleGradingSystemRow(row.id)}
                      />
                    </TableCell>
                    <TableCell>{row.equivalent_grade}</TableCell>
                    <TableCell>{row.min_score}–{row.max_score}</TableCell>
                    <TableCell>{row.description}</TableCell>
                  </TableRow>
                ))}
                {gradingSystemDraft.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                      No grade conversion rows found. Add them in Admin → Grade Conversion first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
          <Button onClick={closeGradingSystemDialog} color="error" variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSaveGradingSystem} variant="contained" color="success">
            Save Grading System
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={footerNotesDialogOpen} onClose={closeFooterNotesDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: "#6a1b9a", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          📄 Edit Credits & Institution Note
          <IconButton onClick={closeFooterNotesDialog} sx={{ color: "white", border: "2px solid rgba(255,255,255,0.6)", borderRadius: "50%", width: 40, height: 40, padding: 0 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <TextField
            fullWidth multiline minRows={2} label="Credits line"
            value={creditsNoteDraft} onChange={(e) => setCreditsNoteDraft(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Shown after the school name (which is filled in automatically).
          </Typography>
          <TextField
            fullWidth multiline minRows={3} label="Institution note"
            value={institutionNoteDraft} onChange={(e) => setInstitutionNoteDraft(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
          <Button onClick={closeFooterNotesDialog} color="error" variant="outlined">Cancel</Button>
          <Button onClick={handleSaveFooterNotes} variant="contained" color="success">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={admissionCredentialsDialogOpen}
        onClose={closeAdmissionCredentialsDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: "#c2410c",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          🎓 Edit Admission Credentials
          <IconButton
            onClick={closeAdmissionCredentialsDialog}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "50%",
              width: 40,
              height: 40,
              padding: 0,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.2)", border: "2px solid white" },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This text appears in the ADMISSION CREDENTIALS field on every page of
            the Transcript of Records, both on-screen and in the downloaded PDF.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Admission Credentials"
            value={admissionCredentialsDraft}
            onChange={(e) => setAdmissionCredentialsDraft(e.target.value)}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
          <Button onClick={closeAdmissionCredentialsDialog} color="error" variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSaveAdmissionCredentials} variant="contained" color="success">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={4000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity="warning"
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TranscriptOfRecords;

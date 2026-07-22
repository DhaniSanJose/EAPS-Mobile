import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  forwardRef,
} from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  TextField,
  MenuItem,
  Container,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import FreeTuitionImage from "../assets/FreeTuition.png";
import EaristLogo from "../assets/EaristLogo.png";
import "../styles/Print.css";
import { Search } from "@mui/icons-material";
import { FcPrint } from "react-icons/fc";
import { MdOutlinePayment } from "react-icons/md";
import { IoMdSchool } from "react-icons/io";
import { useLocation } from "react-router-dom";
import API_BASE_URL from "../apiConfig";
import { postAuditEvent, getAuditHeaders } from "../utils/auditEvents";
import useAuditMac from "../utils/useAuditMac";

const CertificateOfRegistration = forwardRef(
  ({ student_number, onReadyChange }, divToPrintRef) => {
    useAuditMac();
    const settings = useContext(SettingsContext);
    const [fetchedLogo, setFetchedLogo] = useState(null);
    const [companyName, setCompanyName] = useState("");
    const [branches, setBranches] = useState([]);

    useEffect(() => {
      if (settings) {
        if (settings.logo_url) {
          setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        } else {
          setFetchedLogo(EaristLogo);
        }

        if (settings.company_name) setCompanyName(settings.company_name);
        if (settings?.branches) {
          try {
            const parsed =
              typeof settings.branches === "string"
                ? JSON.parse(settings.branches)
                : settings.branches;
            setBranches(Array.isArray(parsed) ? parsed : []);
          } catch (err) {
            console.error("Failed to parse branches:", err);
            setBranches([]);
          }
        }
      }
    }, [settings]);

    const words = companyName.trim().split(" ");
    const middle = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, middle).join(" ");
    const secondLine = words.slice(middle).join(" ");

    const [data, setData] = useState([]);
    const [studentNumber, setStudentNumber] = useState("");
    const effectiveStudentNumber =
      student_number?.trim() || studentNumber?.trim() || "";
    const hasStudentData = Boolean(effectiveStudentNumber && data?.[0]);

    useEffect(() => {
      if (student_number?.trim()) {
        setStudentNumber(student_number.trim());
      }
    }, [student_number]);

    const [profilePicture, setProfilePicture] = useState(null);
    const [personID, setPersonID] = useState("");
    const [person, setPerson] = useState({
      profile_img: "",
      campus: "",
      // ...(unchanged from your existing file 2/3 `person` initial state)
    });

    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");

    const [campusAddress, setCampusAddress] = useState("");

    // Needed by handleSaveToUnifast/handleSaveToMatriculation payload (campus_name)
    const getBranchName = (branchId) => {
      const matchedBranch = branches.find(
        (branch) =>
          String(branch?.id) === String(branchId) ||
          String(branch?.branch_id) === String(branchId),
      );
      return (
        matchedBranch?.branch ||
        matchedBranch?.branch_name ||
        matchedBranch?.name ||
        ""
      );
    };

    useEffect(() => {
      if (!settings) return;
      const branchId = person?.campus;
      const matchedBranch = branches.find(
        (branch) => String(branch?.id) === String(branchId),
      );
      if (matchedBranch?.address) {
        setCampusAddress(matchedBranch.address);
        return;
      }
      if (settings.campus_address) {
        setCampusAddress(settings.campus_address);
        return;
      }
      setCampusAddress(settings.address || "");
    }, [settings, branches, person?.campus]);

    const [approvedBy, setApprovedBy] = useState(null);
    const [approvedBySignatureMissing, setApprovedBySignatureMissing] =
      useState(false);
    const [qrCodeMissing, setQrCodeMissing] = useState(false);
    const approvedBySignature =
      typeof approvedBy?.signature_image === "string"
        ? approvedBy.signature_image.trim()
        : "";
    const approvedBySignatureUrl = approvedBySignature
      ? `${API_BASE_URL}/uploads/${approvedBySignature}`
      : "";
    const showApprovedBySignature = Boolean(
      effectiveStudentNumber &&
      approvedBySignatureUrl &&
      !approvedBySignatureMissing,
    );

    useEffect(() => {
      setApprovedBySignatureMissing(false);
    }, [approvedBySignatureUrl]);

    useEffect(() => {
      setQrCodeMissing(false);
    }, [effectiveStudentNumber]);

    useEffect(() => {
      const fetchApprovedBy = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/signature-latest`);
          const data = await res.json();
          if (data.success) setApprovedBy(data.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchApprovedBy();
    }, []);

    const fetchPersonData = async (id) => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/person/${id}`);
        setPerson(res.data);
        if (res.data?.student_number) {
          setStudentNumber(String(res.data.student_number));
        }
      } catch (error) {
        console.error("Failed to fetch person:", error);
      }
    };

    const fetchStudentNumberByPerson = async (id) => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/student/${id}`);
        if (res.data?.student_number) {
          setStudentNumber(String(res.data.student_number));
        }
      } catch (error) {
        console.error("Failed to fetch student number:", error);
      }
    };

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const queryPersonId = queryParams.get("person_id");

    // do not alter
    useEffect(() => {
      const storedUser = localStorage.getItem("email");
      const storedRole = localStorage.getItem("role");
      const loggedInPersonId = localStorage.getItem("person_id");
      const searchedPersonId = sessionStorage.getItem("admin_edit_person_id");

      if (!storedUser || !storedRole || !loggedInPersonId) {
        window.location.href = "/login";
        return;
      }

      setUser(storedUser);
      setUserRole(storedRole);

      const allowedRoles = ["registrar", "applicant", "student"];
      if (allowedRoles.includes(storedRole)) {
        const targetId = searchedPersonId || queryPersonId || loggedInPersonId;
        setUserID(targetId);
        fetchPersonData(targetId);
        if (!student_number?.trim() && storedRole === "student") {
          fetchStudentNumberByPerson(targetId);
        }
        return;
      }

      window.location.href = "/login";
    }, [queryPersonId]);

    const fetchProfilePicture = async (person_id) => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/user/${person_id}`);
        if (res.data && res.data.profile_img) {
          setProfilePicture(
            `${API_BASE_URL}/uploads/Student1by1/${res.data.profile_img}`,
          );
        }
      } catch (error) {
        console.error("Error fetching profile picture:", error);
        setProfilePicture(null);
      }
    };

    useEffect(() => {
      if (personID) fetchProfilePicture(personID);
    }, [personID]);

    const [shortDate, setShortDate] = useState("");
    const [longDate, setLongDate] = useState("");

    useEffect(() => {
      const updateDates = () => {
        const now = new Date();
        const formattedShort = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;
        setShortDate(formattedShort);

        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        const hours = String(now.getHours() % 12 || 12).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        const ampm = now.getHours() >= 12 ? "PM" : "AM";
        setLongDate(`${month} ${day}, ${year} ${hours}:${minutes}:${seconds} ${ampm}`);
      };
      updateDates();
      const interval = setInterval(updateDates, 1000);
      return () => clearInterval(interval);
    }, []);

    const [courses, setCourses] = useState([]);
    const [enrolled, setEnrolled] = useState([]);
    const [isEnrolledLoaded, setIsEnrolledLoaded] = useState(false);

    const [userId, setUserId] = useState(null);
    const [first_name, setUserFirstName] = useState(null);
    const [middle_name, setUserMiddleName] = useState(null);
    const [last_name, setUserLastName] = useState(null);
    const [currId, setCurr] = useState(null);
    const [courseCode, setCourseCode] = useState("");
    const [courseDescription, setCourseDescription] = useState("");

    const [sections, setSections] = useState([]);
    const [selectedSection, setSelectedSection] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [selectedDepartment, setSelectedDepartment] = useState(null);

    const [subjectCounts, setSubjectCounts] = useState({});
    const [year_Level_Description, setYearLevelDescription] = useState(null);
    const [major, setMajor] = useState(null);
    // NEW: needed for isFirstYear check used by fee logic below
    const [yearlevel, setYearLevelId] = useState("");

    useEffect(() => {
      if (selectedSection) fetchSubjectCounts(selectedSection);
    }, [selectedSection]);

    const fetchSubjectCounts = async (sectionId) => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/subject-enrollment-count`,
          { params: { sectionId } },
        );
        const counts = {};
        response.data.forEach((item) => {
          counts[item.subject_id] = item.enrolled_count;
        });
        setSubjectCounts(counts);
      } catch (err) {
        console.error("Failed to fetch subject counts", err);
      }
    };

    useEffect(() => {
      if (currId) {
        axios
          .get(`${API_BASE_URL}/api/courses/${currId}`)
          .then((res) => setCourses(res.data))
          .catch((err) => console.error(err));
      }
    }, [currId]);

    useEffect(() => {
      if (userId && currId) {
        setIsEnrolledLoaded(false);
        axios
          .get(`${API_BASE_URL}/api/enrolled_courses/${userId}/${currId}`)
          .then((res) => setEnrolled(Array.isArray(res.data) ? res.data : []))
          .catch((err) => {
            console.error(err);
            setEnrolled([]);
          })
          .finally(() => setIsEnrolledLoaded(true));
      } else {
        setIsEnrolledLoaded(false);
      }
    }, [userId, currId]);

    useEffect(() => {
      if (typeof onReadyChange === "function") {
        onReadyChange(
          Boolean(
            effectiveStudentNumber &&
            data[0]?.student_number &&
            userId &&
            currId &&
            isEnrolledLoaded,
          ),
        );
      }
    }, [onReadyChange, effectiveStudentNumber, data, userId, currId, isEnrolledLoaded]);

    useEffect(() => {
      fetchDepartmentSections();
    }, []);

    useEffect(() => {
      if (selectedDepartment) fetchDepartmentSections();
    }, [selectedDepartment]);

    const fetchDepartmentSections = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${API_BASE_URL}/api/department-sections`,
          { params: { departmentId: selectedDepartment } },
        );
        setTimeout(() => {
          setSections(response.data);
          setLoading(false);
        }, 700);
      } catch (err) {
        console.error("Error fetching department sections:", err);
        setError("Failed to load department sections");
        setLoading(false);
      }
    };

    const [gender, setGender] = useState(null);
    const [age, setAge] = useState(null);
    const [email, setEmail] = useState(null);
    const [program, setProgram] = useState(null);
    const [course_unit, setCourseUnit] = useState(null);
    const [lab_unit, setLabUnit] = useState(null);
    const [year_desc, setYearDescription] = useState(null);
    const [savedUnifast, setSavedUnifast] = useState(false);
    const [savedMatriculation, setSavedMatriculation] = useState(false);
    const [isPaymentStatusLoaded, setIsPaymentStatusLoaded] = useState(false);
    const [selectedPaymentData, setSelectedPaymentData] = useState(null);

    // NEW: fee totals + flags used by the fee table / Save handlers (mirrors file 1)
    const [totalLecFees, setTotalLecFees] = useState(0);
    const [totalLabFees, setTotalLabFees] = useState(0);
    const [isHaveNSTP, setIsHaveNSTP] = useState(0);
    const [isHaveComputerFees, setIsHaveComputerFees] = useState(0);
    const [isHaveLaboratory, setIsHaveLaboratory] = useState(0);

    useEffect(() => {
      if (!effectiveStudentNumber) return;

      const fetchStudent = async () => {
        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/student-tagging`,
            { studentNumber: effectiveStudentNumber },
            { headers: { "Content-Type": "application/json" } },
          );

          // TODO: confirm your /api/student-tagging response actually
          // includes these fee/flag fields (file 1 gets them from the
          // /api/student-tagging/dprtmnt endpoint instead). Adjust field
          // names below to match your backend if different.
          setTotalLecFees(Number(response.data.totalLecFee || 0));
          setTotalLabFees(Number(response.data.totalLabFee || 0));
          setIsHaveNSTP(Number(response.data.totalNstpCount || 0));
          setIsHaveComputerFees(Number(response.data.totalComputerLab || 0));
          setIsHaveLaboratory(Number(response.data.totalLaboratory || 0));

          const {
            token2,
            person_id2,
            studentNumber: studentNum,
            activeCurriculum: active_curriculum,
            major,
            yearLevel,
            yearLevelDescription: yearLevelDescription,
            yearDesc: yearDesc,
            courseCode: course_code,
            courseDescription: course_desc,
            departmentName: dprtmnt_name,
            courseUnit: course_unit,
            labUnit: lab_unit,
            firstName: first_name,
            middleName: middle_name,
            lastName: last_name,
          } = response.data;

          localStorage.setItem("token2", token2);
          localStorage.setItem("person_id2", person_id2);
          localStorage.setItem("studentNumber", studentNum);
          localStorage.setItem("activeCurriculum", active_curriculum);
          localStorage.setItem("major", major);
          localStorage.setItem("yearLevel", yearLevel);
          localStorage.setItem("departmentName", dprtmnt_name);
          localStorage.setItem("courseCode", course_code);
          localStorage.setItem("courseDescription", course_desc);
          localStorage.setItem("courseUnit", course_unit);
          localStorage.setItem("labUnit", lab_unit);
          localStorage.setItem("firstName", first_name);
          localStorage.setItem("middleName", middle_name);
          localStorage.setItem("lastName", last_name);
          localStorage.setItem("yearLevelDescription", yearLevelDescription);
          localStorage.setItem("yearDesc", yearDesc);

          setUserId(studentNum);
          setUserFirstName(first_name);
          setUserMiddleName(middle_name);
          setUserLastName(last_name);
          setCurr(active_curriculum);
          setMajor(major || "");
          setDepartments(dprtmnt_name);
          setCourseCode(course_code);
          setCourseDescription(course_desc);
          setCourseUnit(course_unit);
          setLabUnit(lab_unit);
          setPersonID(person_id2);
          setYearLevelDescription(yearLevelDescription);
          setYearLevelId(yearLevel); // NEW
          setYearDescription(yearDesc);

          const fullData = {
            ...(response.data.corData || {}),
            branch_id: person?.campus || "", // NEW, needed by requestedData
            campus: person?.campus || "", // NEW
            student_number: studentNum,
            first_name,
            middle_name,
            last_name,
            extension:
              response.data.extension || response.data.corData?.extension || "",
            major: major || response.data.corData?.major || "",
            year_level_description: yearLevelDescription,
            year_description: yearDesc,
            curriculum_id: active_curriculum,
            program:
              active_curriculum ||
              response.data.program ||
              response.data.corData?.program ||
              "",
            departmentName:
              dprtmnt_name || response.data.corData?.departmentName || "",
            dprtmnt_name:
              dprtmnt_name || response.data.corData?.dprtmnt_name || "",
            college: dprtmnt_name || response.data.corData?.college || "",
            age: response.data.age ?? response.data.corData?.age ?? "",
            gender: response.data.gender ?? response.data.corData?.gender ?? "",
            email:
              response.data.email ??
              response.data.corData?.email ??
              response.data.emailAddress ??
              "",
            emailAddress:
              response.data.emailAddress ??
              response.data.email ??
              response.data.corData?.emailAddress ??
              "",
          };
          setData([fullData]);

          setGender(fullData.gender ?? null);
          setAge(fullData.age ?? null);
          setEmail(fullData.email || fullData.emailAddress || null);
          setProgram(active_curriculum);
        } catch (error) {
          console.error("Student search failed:", error);
        }
      };

      fetchStudent();
    }, [effectiveStudentNumber]);

    useEffect(() => {
      if (!effectiveStudentNumber) {
        setSavedUnifast(false);
        setSavedMatriculation(false);
        setIsPaymentStatusLoaded(false);
        return;
      }
      setIsPaymentStatusLoaded(false);

      const fetchPaymentStatus = async () => {
        try {
          const res = await axios.get(
            `${API_BASE_URL}/api/payment-status/${effectiveStudentNumber}`,
          );
          if (res.data?.success) {
            setSavedUnifast(!!res.data.saved_unifast);
            setSavedMatriculation(!!res.data.saved_matriculation);
          } else {
            setSavedUnifast(false);
            setSavedMatriculation(false);
          }
        } catch (error) {
          console.error("Failed to fetch payment status:", error);
          setSavedUnifast(false);
          setSavedMatriculation(false);
        } finally {
          setIsPaymentStatusLoaded(true);
        }
      };

      fetchPaymentStatus();
    }, [effectiveStudentNumber]);

    useEffect(() => {
      if (!effectiveStudentNumber || !isPaymentStatusLoaded) {
        setSelectedPaymentData(null);
        return;
      }
      if (!savedUnifast && !savedMatriculation) {
        setSelectedPaymentData(null);
        return;
      }
      const endpoint = savedUnifast
        ? "/get_student_data_unifast"
        : "/get_student_data_matriculation";

      const fetchPaymentData = async () => {
        try {
          const res = await axios.get(`${API_BASE_URL}/api${endpoint}`);
          const rows = Array.isArray(res.data) ? res.data : [];
          const matched = rows
            .filter(
              (item) =>
                String(item?.student_number) === String(effectiveStudentNumber) &&
                Number(item?.status) === 1,
            )
            .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
          setSelectedPaymentData(matched[0] || null);
        } catch (error) {
          console.error("Failed to fetch payment data:", error);
          setSelectedPaymentData(null);
        }
      };

      fetchPaymentData();
    }, [effectiveStudentNumber, savedUnifast, savedMatriculation, isPaymentStatusLoaded]);

    const formatFee = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return "";
      return numeric.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const scholarshipDiscountValue = savedUnifast
      ? "UNIFAST-FHE"
      : selectedPaymentData?.matriculation_remark || "";
    const officialReceiptValue = savedUnifast
      ? "Scholar"
      : selectedPaymentData?.matriculation_remark
        ? "Scholar"
        : "";
    const showFreeTuitionStamp = Boolean(effectiveStudentNumber);

    useEffect(() => {
      const fetchDepartments = async () => {
        try {
          const res = await axios.get(`${API_BASE_URL}/api/departments`);
          setDepartments(res.data);
        } catch (err) {
          console.error("Error fetching departments:", err);
        }
      };
      fetchDepartments();
    }, []);

    // ===== NEW: pulled from file 1 (tosf / scholarship / active school year) =====
    const [tosf, setTosfData] = useState([]);
    const [scholarshipTypes, setScholarshipTypes] = useState([]);
    const [activeSchoolYear, setActiveSchoolYear] = useState([]);

    const fetchTosf = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/tosf`);
        setTosfData(res.data);
      } catch (error) {
        console.error("Error fetching tosf data:", error);
      }
    };

    const fetchScholarship = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/scholarship_types`);
        const activeTypes = Array.isArray(res.data)
          ? res.data.filter((item) => Number(item.scholarship_status) === 1)
          : [];
        setScholarshipTypes(activeTypes);
      } catch (error) {
        console.error("Error fetching scholarship types:", error);
      }
    };

    useEffect(() => {
      fetchTosf();
    }, []);

    useEffect(() => {
      fetchScholarship();
    }, []);

    useEffect(() => {
      axios
        .get(`${API_BASE_URL}/api/get_active_school_years`)
        .then((res) => setActiveSchoolYear(res.data))
        .catch((err) => console.error(err));
    }, []);

    const toWholeUnit = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num) : 0;
    };

    const totalCourseUnits = enrolled.reduce(
      (sum, item) => sum + toWholeUnit(item.course_unit),
      0,
    );
    const totalLabUnits = enrolled.reduce(
      (sum, item) => sum + toWholeUnit(item.lab_unit),
      0,
    );
    const totalCombined = totalCourseUnits + totalLabUnits;

    const isFirstYear = Number(yearlevel) === 1;
    const isFirstSemester = Number(activeSchoolYear[0]?.semester_id) === 1;
    const isFirstYearFirstSem = isFirstYear && isFirstSemester;

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

    // ===== NEW: requestedData + payment save logic (mirrors file 1) =====
    const [requestedData, setRequestedData] = useState({
      campus_name: "",
      branch_id: "",
      student_number: "",
      learner_reference_number: "",
      last_name: "",
      given_name: "",
      middle_initial: "",
      degree_program: "",
      year_level: "",
      sex: "",
      email_address: "",
      phone_number: "",
      laboratory_units: 0,
      computer_units: 0,
      academic_units_enrolled: 0,
      academic_units_nstp_enrolled: 0,
      tuition_fees: 0,
      nstp_fees: 0,
      athletic_fees: 0,
      computer_fees: 0,
      cultural_fees: 0,
      development_fees: 0,
      guidance_fees: 0,
      laboratory_fees: 0,
      library_fees: 0,
      medical_and_dental_fees: 0,
      registration_fees: 0,
      school_id_fees: 0,
      total_tosf: 0,
      remark: "",
      active_school_year_id: 1,
    });

    useEffect(() => {
      if (
        !data[0]?.student_number ||
        !tosf[0] ||
        !activeSchoolYear[0] ||
        totalLabFees == null ||
        totalLecFees == null ||
        yearlevel === "" ||
        yearlevel == null
      ) {
        return;
      }

      const middleInitial = data[0]?.middle_name?.[0] || "";
      const branchId = person?.campus || "";
      const campusName = getBranchName(branchId);
      const genderLabel = String(data[0]?.gender) === "1" ? "Female" : "Male";
      const baseTotalSum = totalLecFees + totalLabFees;
      const totalSum = isFirstYear
        ? baseTotalSum - tosf[0]?.nstp_fees
        : baseTotalSum;
      const schoolIdFee = isFirstYearFirstSem
        ? Number(tosf[0]?.school_id_fees || 0)
        : 0;
      const totalTotalTOSF =
        totalSum +
        Number(tosf[0]?.cultural_fee || 0) +
        Number(tosf[0]?.athletic_fee || 0) +
        (isHaveNSTP !== 0 ? Number(tosf[0]?.nstp_fees || 0) : 0) +
        Number(tosf[0]?.developmental_fee || 0) +
        Number(tosf[0]?.guidance_fee || 0) +
        Number(tosf[0]?.library_fee || 0) +
        Number(tosf[0]?.medical_and_dental_fee || 0) +
        Number(tosf[0]?.registration_fee || 0) +
        schoolIdFee +
        (isHaveComputerFees !== 0 ? Number(tosf[0]?.computer_fees || 0) : 0) +
        (isHaveLaboratory !== 0 ? Number(tosf[0]?.laboratory_fees || 0) : 0);

      setRequestedData({
        campus_name: campusName,
        branch_id: branchId,
        student_number: data[0]?.student_number,
        learner_reference_number: data[0]?.lrnNumber,
        last_name: data[0]?.last_name,
        given_name: data[0]?.first_name,
        middle_initial: middleInitial,
        degree_program: data[0]?.program,
        year_level: year_Level_Description,
        sex: genderLabel,
        email_address: data[0]?.email,
        phone_number: data[0]?.cellphoneNumber,
        laboratory_units: totalLabUnits,
        computer_units: 3, // ONGOING
        academic_units_enrolled: totalCombined,
        academic_units_nstp_enrolled: 3,
        tuition_fees: totalSum,
        nstp_fees: isHaveNSTP !== 0 ? Number(tosf[0]?.nstp_fees || 0) : 0,
        athletic_fees: tosf[0]?.athletic_fee || 0,
        computer_fees:
          isHaveComputerFees !== 0 ? Number(tosf[0]?.computer_fees || 0) : 0,
        cultural_fees: tosf[0]?.cultural_fee || 0,
        development_fees: tosf[0]?.developmental_fee || 0,
        guidance_fees: tosf[0]?.guidance_fee || 0,
        laboratory_fees:
          isHaveLaboratory !== 0 ? Number(tosf[0]?.laboratory_fees || 0) : 0,
        library_fees: tosf[0]?.library_fee || 0,
        medical_and_dental_fees: tosf[0]?.medical_and_dental_fee || 0,
        registration_fees: tosf[0]?.registration_fee,
        school_id_fees: schoolIdFee,
        total_tosf: totalTotalTOSF,
        remark: "",
        active_school_year_id: activeSchoolYear[0]?.id || null,
      });
    }, [
      data,
      tosf,
      enrolled,
      totalLabFees,
      totalLecFees,
      branches,
      person?.campus,
      activeSchoolYear,
      isHaveNSTP,
      isHaveComputerFees,
      isHaveLaboratory,
      year_Level_Description,
      yearlevel,
    ]);

    const toNumber = (value) => {
      if (typeof value === "string") {
        const cleaned = value.replace(/[^0-9.-]/g, "");
        const parsedFromString = Number(cleaned);
        return Number.isFinite(parsedFromString) ? parsedFromString : 0;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const toDecimalPercent = (value) => {
      const numeric = toNumber(value);
      if (numeric <= 0) return 0;
      return numeric > 1 ? numeric / 100 : numeric;
    };

    const round2 = (value) =>
      Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;

    const applyScholarshipToMatriculationFees = (baseData, scholarship) => {
      if (!scholarship) {
        return { payload: { ...baseData, scholarship_id: null }, computed: null };
      }

      const tuitionFee = toNumber(baseData.tuition_fees);
      const nstpFee = toNumber(baseData.nstp_fees);

      const miscKeys = [
        "cultural_fees",
        "athletic_fees",
        "development_fees",
        "guidance_fees",
        "library_fees",
        "medical_and_dental_fees",
        "registration_fees",
        "school_id_fees",
        "computer_fees",
        "laboratory_fees",
      ];

      const miscTotal = miscKeys.reduce((sum, key) => sum + toNumber(baseData[key]), 0);

      const afd = toNumber(scholarship.afd);
      const hasAfdOverride = afd > 0;

      const tfdDec = toDecimalPercent(scholarship.tfd);
      const mfdDec = toDecimalPercent(scholarship.mfd);
      const nfdDec = toDecimalPercent(scholarship.nfd);

      let finalTuitionFee = tuitionFee;
      let finalMiscTotal = miscTotal;
      let finalNstpFee = nstpFee;

      if (!hasAfdOverride) {
        finalTuitionFee = tuitionFee - tuitionFee * tfdDec;
        finalMiscTotal = miscTotal - miscTotal * mfdDec;
        finalNstpFee = nstpFee - nstpFee * nfdDec;
      }

      finalTuitionFee = round2(finalTuitionFee);
      finalMiscTotal = round2(finalMiscTotal);
      finalNstpFee = round2(finalNstpFee);

      const miscScale = miscTotal > 0 ? finalMiscTotal / miscTotal : 0;
      const scaledMiscEntries = miscKeys.map((key) => ({
        key,
        value: round2(toNumber(baseData[key]) * miscScale),
      }));

      if (scaledMiscEntries.length > 0) {
        const scaledMiscSum = scaledMiscEntries.reduce((sum, item) => sum + item.value, 0);
        const delta = round2(finalMiscTotal - scaledMiscSum);
        scaledMiscEntries[scaledMiscEntries.length - 1].value = round2(
          scaledMiscEntries[scaledMiscEntries.length - 1].value + delta,
        );
      }

      const scaledMiscMap = scaledMiscEntries.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

      const totalTosf = round2(finalTuitionFee + finalNstpFee + finalMiscTotal);

      return {
        payload: {
          ...baseData,
          ...scaledMiscMap,
          tuition_fees: finalTuitionFee,
          nstp_fees: finalNstpFee,
          registration_fees: scaledMiscMap.registration_fees ?? 0,
          total_tosf: totalTosf,
          total_misc: finalMiscTotal,
          scholarship_id: scholarship.id ? Number(scholarship.id) : null,
        },
        computed: {
          scholarship_name: scholarship.scholarship_name || "",
          tfd: scholarship.tfd ?? 0,
          mfd: scholarship.mfd ?? 0,
          nfd: scholarship.nfd ?? 0,
          afd: scholarship.afd ?? 0,
          miscTotal,
          finalMiscTotal,
          finalTuitionFee,
          finalNstpFee,
        },
      };
    };

    const insertPaymentAuditLog = async (paymentTarget) => {
      try {
        await postAuditEvent("payment_saved", {
          student_number: requestedData.student_number,
          payment_target: paymentTarget,
        });
      } catch (err) {
        console.error("Error inserting audit log");
      }
    };

    const handleSaveToUnifast = async () => {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/save_to_unifast`,
          { ...requestedData, status: 1 },
          { headers: getAuditHeaders() },
        );
        if (res.data.success) {
          setSavedUnifast(true);
          await insertPaymentAuditLog("UniFAST");
        } else {
          console.error(res.data.message || "Failed to save data");
        }
      } catch (error) {
        console.error(error);
      }
    };

    const handleSaveToMatriculation = async () => {
      try {
        if (!selectedScholarshipId) {
          console.error("Please select a scholarship type.");
          return false;
        }
        const scholarship = scholarshipTypes.find(
          (item) => Number(item.id) === Number(selectedScholarshipId),
        );
        if (!scholarship) {
          console.error("Selected scholarship type not found.");
          return false;
        }
        const { payload } = applyScholarshipToMatriculationFees(
          { ...requestedData, status: 1 },
          scholarship,
        );
        const res = await axios.post(
          `${API_BASE_URL}/api/save_to_matriculation`,
          { ...payload },
          { headers: getAuditHeaders() },
        );
        if (res.data.success) {
          setSavedMatriculation(true);
          await insertPaymentAuditLog("Matriculation");
          return true;
        } else {
          console.error(res.data.message || "Failed to save data");
          return false;
        }
      } catch (error) {
        console.error(error);
        return false;
      }
    };

    // ===== NEW: dialog/modal state + handlers used by the JSX buttons =====
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTarget, setConfirmTarget] = useState(null);
    const [scholarshipModalOpen, setScholarshipModalOpen] = useState(false);
    const [selectedScholarshipId, setSelectedScholarshipId] = useState("");

    const openConfirm = (target) => {
      setConfirmTarget(target);
      setConfirmOpen(true);
    };

    const closeConfirm = () => {
      setConfirmOpen(false);
    };

    const openScholarshipModal = () => {
      setScholarshipModalOpen(true);
    };

    const closeScholarshipModal = () => {
      setScholarshipModalOpen(false);
    };

    const handleConfirmScholarshipModal = async () => {
      const saved = await handleSaveToMatriculation();
      if (saved) setScholarshipModalOpen(false);
    };

    const handleConfirmSave = async () => {
      const target = confirmTarget;
      setConfirmOpen(false);
      if (target === "unifast") {
        await handleSaveToUnifast();
      }
    };

    const isAnySaved = savedUnifast || savedMatriculation;
    const unifastLabel = savedUnifast ? "Saved To Unifast" : "Save to Unifast";
    const matriculationLabel = savedMatriculation
      ? "Saved To Matriculation"
      : "Save Matriculation";
    // ===== end NEW =====

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
      <Container className="mb-[4rem]">
        {/* SAVE TO UNIFAST BUTTON */}
        <Box sx={{ position: "relative" }}>
          <button
            onClick={() => openConfirm("unifast")}
            disabled={isAnySaved}
            style={{
              marginBottom: "2rem",
              padding: "10px 20px",
              border: "2px solid black",
              backgroundColor: "#f0f0f0",
              color: "black",
              borderRadius: "5px",
              marginTop: "20px",
              cursor: isAnySaved ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              position: "absolute",
              zIndex: 1000,
              right: "12%",
              top: "-3rem",
              opacity: isAnySaved ? 0.6 : 1,
              transition: "background-color 0.3s, transform 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#d3d3d3")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
            onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
            onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <MdOutlinePayment size={20} />
              {unifastLabel}
            </span>
          </button>

          {/* SAVE TO MATRICULATION BUTTON */}
          <button
            onClick={openScholarshipModal}
            disabled={isAnySaved}
            style={{
              marginBottom: "1rem",
              padding: "10px 20px",
              border: "2px solid black",
              backgroundColor: "#f0f0f0",
              color: "black",
              borderRadius: "5px",
              marginTop: "20px",
              cursor: isAnySaved ? "not-allowed" : "pointer",
              zIndex: 1000,
              position: "absolute",
              right: "-10%",
              top: "-3rem",
              fontSize: "16px",
              fontWeight: "bold",
              opacity: isAnySaved ? 0.6 : 1,
              transition: "background-color 0.3s, transform 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#d3d3d3")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
            onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
            onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IoMdSchool size={20} />
              {matriculationLabel}
            </span>
          </button>
        </Box>

        <Dialog open={confirmOpen} onClose={closeConfirm}>
          <DialogTitle>Confirm Save</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to save this payment to{" "}
              {confirmTarget === "unifast" ? "Unifast" : "Matriculation"}?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              color="error"
              variant="outlined"

              onClick={closeConfirm}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} variant="contained">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={scholarshipModalOpen}
          onClose={closeScholarshipModal}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Select Scholarship Type</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              label="Scholarship Type"
              value={selectedScholarshipId}
              onChange={(e) => setSelectedScholarshipId(e.target.value)}
              sx={{ mt: 1 }}
            >
              {scholarshipTypes.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.scholarship_name}
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button
              color="error"
              variant="outlined"
              onClick={closeScholarshipModal}>
              Cancel
            </Button>
            <Button onClick={handleConfirmScholarshipModal} variant="contained">
              Save to Matriculation
            </Button>
          </DialogActions>
        </Dialog>

        <div className="flex-container">
          <div className="section">
            <Box></Box>

            <div ref={divToPrintRef} className="certificate-wrapper">
              {/* Watermark across the page */}

              <style>
                {`
                 .certificate-wrapper {
                   position: relative;
                 }
 
                 .certificate-watermark {
                   position: absolute;
                   top: 50%;
                   left: 50%;
                   transform: translate(-50%, -50%) rotate(-45deg); /* diagonal */
                   font-size: 7rem; /* adjust to fit your page */
                   font-weight: 900;
                   color: rgba(0, 0, 0, 0.08); /* light grey, adjust opacity */
                   text-transform: uppercase;
                   white-space: nowrap;
                   pointer-events: none;
                   user-select: none;
                   z-index: 9999;
                 }
 
                 @media print {
                   .certificate-watermark {
                     color: rgba(0, 0, 0, 0.15); /* a bit darker so it prints */
                   }
                   button {
                     display: none;
                   }
                   .fee-table-con{
                     width: calc(8in - 2px) !important;
                   }
                 }
               `}</style>

              <div className="section">
                <table
                  className="student-table"
                  style={{
                    borderCollapse: "collapse",
                    fontFamily: "Arial",
                    width: "8in",
                    margin: "0 auto", // Center the table inside the form
                    textAlign: "center",
                    tableLayout: "fixed",
                    marginTop: "-40px"
                  }}
                >
                  <style>
                    {`
                   @media print {
                     .Box {
                       display: none;
                     }
 
                   }
                 `}
                  </style>

                  <tbody>
                    <tr>
                      <td
                        colSpan={2}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      >
                        <b></b>
                      </td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                      <td
                        colSpan={1}
                        style={{ height: "0.1in", fontSize: "72.5%" }}
                      ></td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{ height: "0.1in", fontSize: "40%" }}
                      ></td>
                    </tr>
                    <tr>
                      <td
                        colSpan={40}
                        style={{ height: "0.5in", textAlign: "center" }}
                      >
                        <table
                          width="100%"
                          style={{ borderCollapse: "collapse" }}
                        >
                          <tbody>
                            <tr>
                              <td style={{ width: "20%", textAlign: "center" }}>
                                <img
                                  src={fetchedLogo || EaristLogo}
                                  alt="School Logo"
                                  style={{
                                    marginLeft: "10px",
                                    width: "110px",
                                    height: "110px",
                                    borderRadius: "50%", // ? makes it circular
                                    objectFit: "cover",
                                  }}
                                />
                              </td>

                              {/* Center Column - School Information */}
                              <td
                                style={{
                                  width: "60%",
                                  textAlign: "center",
                                  lineHeight: "1",
                                  fontFamily: "Arial",
                                }}
                              >
                                <div style={{ fontFamily: "Arial", fontSize: "13px" }}>
                                  Republic of the Philippines
                                </div>
                                <div
                                  style={{
                                    fontWeight: "bold",
                                    fontFamily: "Arial",
                                    fontSize: "16px",
                                    textTransform: "Uppercase"
                                  }}
                                >
                                  {firstLine}
                                </div>
                                {secondLine && (
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontFamily: "Arial",
                                      fontSize: "16px",
                                      textTransform: "Uppercase"
                                    }}
                                  >
                                    {secondLine}
                                  </div>
                                )}
                                <div>{campusAddress}</div>

                                {/* Add spacing here */}
                                <div style={{ marginTop: "30px" }}>
                                  <b
                                    style={{
                                      fontSize: "20px",
                                      letterSpacing: "2px",
                                    }}
                                  >
                                    CERTIFICATE OF REGISTRATION
                                  </b>
                                </div>
                              </td>

                              <td
                                colSpan={4}
                                rowSpan={6}
                                style={{
                                  textAlign: "center",
                                  position: "relative",
                                  width: "4.5cm",
                                  height: "4.5cm",
                                }}
                              >
                                <div
                                  style={{
                                    width: "3.50cm",
                                    height: "3.50cm",
                                    marginRight: "30px",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    position: "relative",
                                    border: "1px solid #ccc",
                                  }}
                                >
                                  {profilePicture ? (
                                    <img
                                      src={profilePicture}
                                      alt="Profile"
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#666",
                                      }}
                                    >
                                      No Profile Picture Found
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td
                        colSpan={10}
                        style={{
                          height: "0.1in",
                          fontSize: "55%",
                          textAlign: "start",

                        }}
                      >
                        <b
                          style={{
                            fontFamily: "Arial",
                            fontSize: "11px",
                            color: "black",
                            textAlign: "start",
                            marginLeft: "25px",
                          }}
                        >
                          Registration No:&nbsp;
                          <span style={{ color: "red" }}></span>
                        </b>
                      </td>

                      <td
                        colSpan={30}
                        style={{
                          height: "0.1in",
                          fontSize: "50%",
                          textAlign: "right",

                        }}
                      >
                        <b
                          style={{
                            fontFamily: "Arial",
                            fontSize: "12px",
                            color: "black",
                          }}
                        >
                          Academic Year/Term :{" "}
                          <span style={{ color: "red" }}>{activeSchoolYear[0]?.semester_description}{" "} AY {" "}
                            {activeSchoolYear[0]?.year_description || " "}-{activeSchoolYear[0]?.year_description + 1 || " "}</span>
                        </b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div
                  className="cor-bordered-frame"
                  style={{
                    width: "8in",
                    margin: "0 auto",
                    border: "1px solid black",
                    boxSizing: "border-box",
                  }}
                >
                  <table
                    style={{
                      borderCollapse: "collapse",
                      fontFamily: "Arial",
                      width: "100%",
                      boxSizing: "border-box",
                      tableLayout: "fixed",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td
                          colSpan={42}
                          style={{
                            height: "0.2in",
                            fontSize: "72.5%",
                            backgroundColor: "gray",
                            color: "white",
                          }}
                        >
                          <b>
                            <b
                              style={{
                                border: "1px solid black",
                                color: "black",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                textAlign: "center",
                                display: "block",
                              }}
                            >
                              STUDENT GENERAL INFORMATION
                            </b>
                          </b>
                        </td>
                      </tr>

                      <tr>
                        <td colSpan={4} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>Student No:</div>
                        </td>

                        <td colSpan={11} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{data[0]?.student_number || ""}</div>
                        </td>

                        <td colSpan={4} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>College:</div>
                        </td>

                        {/* College Display */}
                        <td colSpan={16} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{data[0]?.college || ""}</div>
                        </td>
                      </tr>

                      <tr>
                        {/* Name Label */}
                        <td colSpan={4} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>Name:</div>
                        </td>
                        {/* Name Value */}
                        <td colSpan={11} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{`${data[0]?.last_name || ""}, ${data[0]?.first_name || ""} ${data[0]?.middle_name || ""} ${data[0]?.extension || ""}`.trim()}</div>
                        </td>

                        {/* Program Label */}
                        <td colSpan={4} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>Program:</div>
                        </td>

                        <td colSpan={23} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{(() => {
                            const match = curriculumOptions.find(
                              (item) =>
                                item?.curriculum_id?.toString() ===
                                (data[0]?.program ?? "").toString(),
                            );
                            return match
                              ? match.program_description
                              : (data[0]?.program ?? "");
                          })()}</div>
                        </td>
                      </tr>

                      <tr>
                        {/* Gender Label */}
                        <td colSpan={4} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>Gender:</div>
                        </td>

                        {/* Gender Value */}
                        <td colSpan={11} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{String(data[0]?.gender) === "0"
                            ? "Male"
                            : String(data[0]?.gender) === "1"
                              ? "Female"
                              : data[0]?.gender || ""}</div>
                        </td>

                        {/* Major Label */}
                        <td colSpan={4} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>Major:</div>
                        </td>
                        <td colSpan={9} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{major
                            ? major?.charAt(0).toUpperCase() +
                            major?.slice(1).toLowerCase()
                            : ""}</div>
                        </td>

                        {/* Curriculum Label */}
                        <td colSpan={5} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>Curriculum:</div>
                        </td>

                        {/* Curriculum Value */}
                        <td colSpan={9} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{(() => {
                            const curriculumYear =
                              data[0]?.year_description ?? year_desc;
                            return curriculumYear
                              ? `${curriculumYear}-${Number(curriculumYear) + 1}`
                              : "";
                          })()}</div>
                        </td>
                      </tr>

                      <tr>
                        <td colSpan={4} style={{ fontSize: "50%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{"Age:"}</div>
                        </td>
                        <td colSpan={11} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{data[0]?.age || ""}</div>
                        </td>
                        <td colSpan={4} style={{ fontSize: "50%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{"Year Level:"}</div>
                        </td>
                        <td colSpan={9} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{year_Level_Description || ""}</div>
                        </td>
                        <td colSpan={8} style={{ fontSize: "50%" }}>
                          <div style={{
                            fontWeight: "bold",
                            color: "black",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{"Scholarship/Discount:"}</div>
                        </td>
                        <td colSpan={6} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{savedUnifast ? "UNIFAST-FHE " : ""}</div>
                        </td>
                      </tr>

                      <tr>
                        <td colSpan={5} style={{ fontSize: "50%" }}>
                          <div style={{
                            color: "black",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{"Email Address:"}</div>
                        </td>
                        <td colSpan={12} style={{ fontSize: "40%" }}>
                          <div style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "11px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{data[0]?.email || ""}</div>
                        </td>
                      </tr>

                      {/*----------------------------------------------------------------------------------------------------------------------------------*/}

                      <tr>
                        <td
                          colSpan={6}
                          rowSpan={2}
                          style={{
                            color: "black",
                            height: "0.3in",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            fontWeight: "bold",

                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              marginTop: "-1px",
                            }}
                          >
                            CODE
                          </div>
                        </td>
                        <td
                          colSpan={10}
                          rowSpan={2}
                          style={{
                            color: "black",
                            height: "0.3in",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            fontWeight: "bold",
                            backgroundColor: "gray",
                            border: "1px solid black",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              marginTop: "-1px",
                            }}
                          >
                            SUBJECT TITLE
                          </div>
                        </td>

                        <td
                          colSpan={6}
                          style={{
                            color: "black",
                            height: "0.2in",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            fontWeight: "bold",

                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              marginTop: "-1px",
                            }}
                          >
                            UNIT
                          </div>
                        </td>

                        <td
                          colSpan={4}
                          rowSpan={2}
                          style={{
                            color: "black",
                            height: "0.3in",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            fontWeight: "bold",

                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              marginTop: "-1px",
                            }}
                          >
                            SECTION
                          </div>
                        </td>
                        <td
                          colSpan={8}
                          rowSpan={2}
                          style={{
                            color: "black",
                            height: "0.3in",
                            fontSize: "11px",
                            fontWeight: "bold",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              marginTop: "-1px",
                            }}
                          >
                            SCHEDULE ROOM
                          </div>
                        </td>
                        <td
                          colSpan={8}
                          rowSpan={2}
                          style={{
                            color: "black",
                            height: "0.3in",
                            fontFamily: "Arial",
                            fontSize: "11px",
                            fontWeight: "bold",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              marginTop: "-1px",
                            }}
                          >
                            FACULTY
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={1}
                          style={{
                            color: "black",
                            height: "0.1in",
                            fontSize: "50%",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          Lec
                        </td>
                        <td
                          colSpan={1}
                          style={{
                            color: "black",
                            height: "0.1in",
                            fontSize: "50%",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          Lab
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            color: "black",
                            height: "0.1in",
                            fontSize: "50%",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          Credit
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            color: "black",
                            height: "0.1in",
                            fontSize: "50%",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                          }}
                        >
                          Tuition
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            color: "black",
                            height: "0.1in",
                            fontSize: "50%",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                            display: "none",
                          }}
                        >
                          Lec Value
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            color: "black",
                            height: "0.1in",
                            fontSize: "50%",
                            backgroundColor: "gray",
                            border: "1px solid black",
                            textAlign: "center",
                            display: "none",
                          }}
                        >
                          Lab Value
                        </td>
                      </tr>
                      {enrolled.map((item, index) => (
                        <tr key={index}>
                          <td colSpan={6} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              textAlign: "center",
                              background: "none",
                              fontSize: "11px",
                            }}>{item.course_code || ""}</div>
                          </td>
                          <td colSpan={10} style={{ border: "1px solid black" }}>
                            <textarea
                              value={item.course_description || ""}
                              readOnly
                              rows={2} // auto height hint
                              style={{
                                width: "100%",
                                border: "none",
                                background: "none",
                                textAlign: "center",
                                fontSize: "8px",
                                resize: "none",
                                overflow: "hidden",
                                whiteSpace: "normal",
                                wordWrap: "break-word",
                              }}
                            />
                          </td>

                          <td colSpan={1} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "11px",
                            }}>{item.course_unit == null
                              ? ""
                              : toWholeUnit(item.course_unit)}</div>
                          </td>
                          <td colSpan={1} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "11px",
                            }}>{item.lab_unit == null ? "" : toWholeUnit(item.lab_unit)}</div>
                          </td>
                          <td colSpan={2} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "11px",
                            }}>{toWholeUnit(item.course_unit) +
                              toWholeUnit(item.lab_unit)}</div>
                          </td>

                          <td colSpan={2} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "11px",
                            }}>{toWholeUnit(item.course_unit) +
                              toWholeUnit(item.lab_unit)}</div>
                          </td>
                          <td
                            colSpan={2}
                            style={{ border: "1px solid black", display: "none" }}
                          >
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "11px",
                            }}>{item.total_lec_value ?? ""}</div>
                          </td>
                          <td
                            colSpan={2}
                            style={{ border: "1px solid black", display: "none" }}
                          >
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "11px",
                            }}>{item.total_lab_value ?? ""}</div>
                          </td>
                          <td colSpan={4} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "11px",
                            }}>{item.description || ""}</div>
                          </td>
                          <td colSpan={8} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "8px",
                            }}>{`${item.day_description} ${item.school_time_start}-${item.school_time_end}`}</div>
                          </td>
                          <td colSpan={8} style={{ border: "1px solid black" }}>
                            <div style={{
                              width: "98%",
                              border: "none",
                              background: "none",
                              textAlign: "center",
                              fontSize: "8px",
                            }}>{`Prof. ${item.lname}`}</div>
                          </td>
                        </tr>
                      ))}

                      {/*----------------------------------------------------------------------------------------------------------------------------------*/}

                      <tr>
                        <td
                          colSpan={10}
                          style={{
                            height: "0.1in",
                            fontSize: "45%",
                            color: "black",
                            textAlign: "left",
                          }}
                        >
                          <b>Note: Subject marked with "*" is Special Subject</b>
                        </td>
                        <td
                          colSpan={6}
                          style={{
                            fontSize: "50%",
                            color: "black",
                            textAlign: "CENTER",
                          }}
                        >
                          <b>Total Unit(s)</b>
                        </td>
                        <td
                          colSpan={1}
                          style={{
                            fontSize: "11px",
                            color: "black",
                            fontFamily: "Arial",
                            textAlign: "center",
                          }}
                        >
                          {totalCourseUnits}
                        </td>
                        <td
                          colSpan={1}
                          style={{
                            fontSize: "11px",
                            color: "black",
                            fontFamily: "Arial",
                            textAlign: "center",
                          }}
                        >
                          {totalLabUnits}
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            fontSize: "11px",
                            color: "black",
                            fontFamily: "Arial",
                            textAlign: "center",
                          }}
                        >
                          {totalCourseUnits + totalLabUnits}
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            fontSize: "11px",
                            color: "black",
                            fontFamily: "Arial",
                            textAlign: "center",
                          }}
                        >
                          {totalCombined}
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            fontSize: "11px",
                            color: "black",
                            fontFamily: "Arial",
                            textAlign: "center",
                            display: "none",
                          }}
                        >
                          {totalLecFees}
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            fontSize: "11px",
                            color: "black",
                            fontFamily: "Arial",
                            textAlign: "center",
                            display: "none",
                          }}
                        >
                          {totalLabFees}
                        </td>

                        <td
                          colSpan={2}
                          style={{
                            height: "0.1in",
                            fontSize: "55%",
                            color: "black",
                            textAlign: "center",
                          }}
                        ></td>
                        <td
                          colSpan={3}
                          style={{
                            height: "0.1in",
                            fontSize: "55%",
                            color: "black",
                            textAlign: "center",
                          }}
                        ></td>
                      </tr>

                      <tr
                        colSpan={12}
                        style={{
                          color: "white",

                          height: "0.1in",
                          fontSize: "40%",
                          backgroundColor: "gray",
                          textAlign: "center",
                        }}
                      ></tr>
                    </tbody>
                  </table>

                  <div
                    className="fee-table-con"
                    style={{
                      display: "flex",
                      width: "100%",
                      boxSizing: "border-box",
                      alignItems: "flex-start",

                    }}
                  >
                    <div style={{ width: "50%", marginLeft: "9px" }}>
                      <table
                        className="fee-table"
                        style={{
                          borderCollapse: "collapse",
                          fontFamily: "Arial",
                          width: "100%",

                          tableLayout: "fixed",
                          borderLeft: "none",
                          borderRight: "none",
                          borderBottom: "none",
                          borderTop: "none",
                        }}
                      >
                        <style>{`
 
                         .fee-table td {
                           padding-top: 0px;
                           padding-bottom: 0px;
                         }
                         .fee-table input {
                           padding-top: 0px;
                           padding-bottom: 0px;
                           line-height: 1;
                         }
                       `}</style>
                        <tbody>
                          <tr>
                            <td
                              colSpan={20}
                              style={{
                                margin: "0px",
                                padding: "0px",
                                fontSize: "63.5%",
                                border: "1px solid black",
                                backgroundColor: "gray",
                                height: "auto",
                              }}
                            >
                              <div style={{
                                color: "black",
                                fontWeight: "bold",
                                margin: "0px",
                                padding: "0px",
                                textAlign: "center",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                                height: "auto",
                                lineHeight: "1",
                              }}>{"A S S E S S E D  F E E S"}</div>
                            </td>
                          </tr>

                          <tr style={{ borderLeft: "1px solid black", height: "2px", borderRight: "1px solid black" }}>
                            <td colSpan={20}>

                            </td>
                          </tr>

                          <tr style={{ height: "2px", }}>
                            <td colSpan={15} style={{ padding: 0, borderLeft: "1px solid black" }}>
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{`Tuition (${totalCourseUnits} unit(s))`}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "60.5%",
                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "black",
                                width: "100%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{isFirstYear
                                ? Number(totalLecFees) + Number(totalLabFees) - Number(tosf[0]?.nstp_fees)
                                : Number(totalLecFees) + Number(totalLabFees)}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"Athletic Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.athletic_fee || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                display: isHaveNSTP === 0 ? "none" : "block",
                                color: "black",
                                width: "98%",
                                border: "none",
                                paddingLeft: "3px",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"NSTP Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                display: isHaveNSTP === 0 ? "none" : "block",
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.nstp_fees || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"Cultural Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.cultural_fee || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"Developmental Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.developmental_fee || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"Guidance Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.guidance_fee || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"Library Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.library_fee || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Medical and Dental Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.medical_and_dental_fee || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"Registration Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.registration_fee || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",

                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                                display: isFirstYearFirstSem ? "block" : "none",
                              }}>{"School ID Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                display: isFirstYearFirstSem ? "block" : "none",
                                background: "none",
                              }}>{tosf[0]?.school_id_fees || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",

                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                                display:
                                  isHaveComputerFees === 0 ? "none" : "block",
                              }}>{"Computer Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                display:
                                  isHaveComputerFees === 0 ? "none" : "block",
                                background: "none",
                              }}>{tosf[0]?.computer_fees || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={15}
                              style={{
                                fontSize: "40%",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                display: isHaveLaboratory === 0 ? "none" : "block",
                                color: "black",
                                width: "98%",

                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"Laboratory Fee"}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                display: isHaveLaboratory === 0 ? "none" : "block",
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{tosf[0]?.laboratory_fees || "0"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                            <td
                              colSpan={13}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "left",
                                color: "black",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            ></td>
                            <td
                              colSpan={13}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Total Assessment : "}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{totalLecFees +
                                totalLabFees +
                                Number(tosf[0]?.cultural_fee || 0) +
                                Number(tosf[0]?.athletic_fee || 0) +
                                (isHaveNSTP !== 0
                                  ? Number(tosf[0]?.nstp_fees || 0)
                                  : 0) +
                                Number(tosf[0]?.developmental_fee || 0) +
                                Number(tosf[0]?.guidance_fee || 0) +
                                Number(tosf[0]?.library_fee || 0) +
                                Number(tosf[0]?.medical_and_dental_fee || 0) +
                                Number(tosf[0]?.registration_fee || 0) +
                                (isHaveComputerFees !== 0
                                  ? Number(tosf[0]?.computer_fees || 0)
                                  : 0) +
                                (isHaveLaboratory !== 0
                                  ? Number(tosf[0]?.laboratory_fees || 0)
                                  : 0)}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            ></td>
                            <td
                              colSpan={13}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Less Financial Aid : "}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            ></td>
                            <td
                              colSpan={13}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Net Assessed : "}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            ></td>
                            <td
                              colSpan={13}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Credit Memo : "}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>

                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            ></td>
                            <td
                              colSpan={13}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Total Discount : "}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            ></td>
                            <td
                              colSpan={13}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Total Payment : "}</div>
                            </td>
                            <td
                              colSpan={5}
                              style={{
                                fontSize: "40%",
                                marginRight: "20px",

                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                marginRight: "20px",
                                borderLeft: "1px solid black",
                              }}
                            ></td>
                            <td
                              colSpan={18}
                              style={{
                                fontSize: "40%",
                                borderRight: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Outstanding Balance : "}</div>
                            </td>
                          </tr>

                          <tr style={{ borderLeft: "1px solid black", height: "5px", borderRight: "1px solid black" }}>
                            <td>

                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={20}
                              style={{
                                margin: "0px",
                                padding: "0px",
                                fontSize: "63.5%",
                                border: "1px solid black",
                                backgroundColor: "gray",
                                height: "auto",
                              }}
                            >
                              <div style={{
                                color: "black",
                                fontWeight: "bold",
                                margin: "0px",
                                padding: "0px",
                                textAlign: "center",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                                lineHeight: "1",
                              }}>{"S C H E D U L E O F P A Y M E N T"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                fontSize: "40%",
                                border: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"1st Payment/Due"}</div>
                            </td>
                            <td
                              colSpan={6}
                              style={{
                                border: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"2nd Payment/Due"}</div>
                            </td>
                            <td
                              colSpan={7}
                              style={{
                                border: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"3rd Payment/Due"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                fontSize: "40%",
                                border: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                fontWeight: "bold",
                                textAlign: "center",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                            <td
                              colSpan={6}
                              style={{
                                fontSize: "40%",
                                border: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                fontWeight: "bold",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                            <td
                              colSpan={7}
                              style={{
                                fontSize: "40%",
                                border: "1px solid black",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                width: "98%",
                                fontWeight: "bold",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}></div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={12}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                width: "98%",
                                fontWeight: "bold",
                                textDecorationThickness: "2px", // <-- Thicker underline

                                fontFamily: "Arial",
                                fontSize: "11px",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Payment/Validation Date : "}</div>
                            </td>
                            <td
                              colSpan={8}
                              style={{
                                height: "0.25in",
                                fontSize: "11px",
                                fontFamily: "Arial",
                                textAlign: "center",
                                verticalAlign: "middle",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                width: "100%", // ensures full-width underline
                                border: "none",
                                outline: "none",


                                background: "none",
                                borderBottom: "1px solid black", // thicker, longer underline
                              }}>{shortDate}</div>
                            </td>
                          </tr>

                          <tr>
                            <td
                              colSpan={9}
                              style={{
                                fontSize: "40%",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                width: "98%",
                                fontWeight: "bold",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                outline: "none",
                                background: "none",
                              }}>{"Official Receipt :"}</div>
                            </td>
                            <td
                              colSpan={10}
                              style={{
                                fontSize: "40%",
                                textAlign: "center",
                                fontWeight: "Bold",
                              }}
                            >
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                width: "95%",
                                fontWeight: "bold",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                border: "none",
                                outline: "none",
                                background: "none",
                                borderBottom: "1px solid black",
                              }}>{savedUnifast ? "Scholar" : ""}</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ width: "50%", borderLeft: "1px solid black" }}>
                      <table
                        style={{
                          borderCollapse: "collapse",
                          fontFamily: "Arial",
                          width: "100%",
                          margin: "0",
                          textAlign: "center",
                          tableLayout: "fixed",
                          borderLeft: "none",
                          borderBottom: "none",
                          borderTop: "none",
                        }}
                      >
                        <tbody>
                          <br />
                          <tr>
                            <td style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "5px" }}>
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                              }}>{"RULES OF REFUND"}</div>
                            </td>
                          </tr>
                          {[
                            "1. Full refund of tuition fee - Before the start of classes.",
                            "2. 80% refund of tuition fee - within 1 week from the start of classes.",
                            "3. 50% refund - within 2 weeks from the start of classes.",
                            "4. No refund - after the 2nd week of classes.",
                          ].map((rule, index) => (
                            <tr key={`refund-rule-${index}`}>
                              <td style={{ fontSize: "10px" }}>
                                <div style={{
                                  textAlign: "left",
                                  color: "black",
                                  paddingLeft: "40px",
                                  width: "98%",
                                  border: "none",
                                  fontFamily: "Arial",
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                  outline: "none",
                                  background: "none",
                                  fontStyle: "italic",
                                }}>{rule}</div>
                              </td>
                            </tr>
                          ))}

                          <tr>
                            <td style={{ height: "0.12in" }}></td>
                          </tr>

                          <tr>
                            <td style={{ fontSize: "11px", fontWeight: "bold" }}>
                              <div style={{
                                fontWeight: "bold",
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"PLEDGE UPON ADMISSION"}</div>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: "10px", fontWeight: "bold" }}>
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "10px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                                fontStyle: "italic",
                              }}>{"\"As a student of EARIST, I do solemnly promise that I will"}</div>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: "10px", fontWeight: "bold" }}>
                              <div style={{
                                textAlign: "center",
                                color: "black",
                                width: "98%",
                                border: "none",
                                fontFamily: "Arial",
                                fontSize: "10px",
                                fontWeight: "bold",
                                outline: "none",
                                background: "none",
                                fontStyle: "italic",
                              }}>{"comply with the rules and regulations of the Institution.\""}</div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ height: "0.2in" }}></td>
                          </tr>

                          <tr>
                            <td>
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                textDecoration: "underline",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"_________________________________"}</div>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                fontWeight: "bold",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Student's Signature"}</div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ height: "0.12in" }}></td>
                          </tr>
                          <tr>
                            <td style={{ height: "0.12in" }}></td>
                          </tr>

                          <tr>
                            <td style={{ textAlign: "left", paddingLeft: "20px" }}>
                              <div style={{
                                color: "black",
                                textAlign: "left",
                                fontWeight: "bold",
                                width: "98%",
                                border: "none",
                                outline: "none",
                                background: "none",
                                fontSize: "11px"
                              }}>{"APPROVED BY : "}</div>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ textAlign: "center", fontSize: "11px" }}>
                              {showApprovedBySignature ? (
                                <img
                                  src={approvedBySignatureUrl}
                                  alt="Signature"
                                  onError={() =>
                                    setApprovedBySignatureMissing(true)
                                  }
                                  style={{
                                    height: "60px",
                                    objectFit: "contain",
                                    width: "250px",
                                    marginBottom: "2px",
                                    display: !student_number ? "none" : "block",
                                    marginLeft: "auto",
                                    marginRight: "auto",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    height: "60px",
                                    display: !student_number ? "none" : "block",
                                  }}
                                />
                              )}

                              <div
                                style={{
                                  display: "inline-block",
                                  fontFamily: "Arial",
                                  fontSize: "11px",
                                  marginTop: "-10px",
                                  fontWeight: "bold",
                                  lineHeight: "1.1",
                                  textAlign: "center",
                                }}
                              >
                                <div
                                  style={{
                                    minHeight: "14px",
                                    display: !student_number ? "none" : "block",
                                  }}
                                >
                                  {approvedBy?.full_name || ""}
                                </div>
                                <div style={{ whiteSpace: "pre", marginTop: "-6px" }}>
                                  __________________________________
                                </div>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <div style={{
                                color: "black",
                                textAlign: "center",
                                width: "98%",
                                fontWeight: "bold",
                                fontFamily: "Arial",
                                fontSize: "11px",
                                border: "none",
                                outline: "none",
                                background: "none",
                              }}>{"Registrar"}</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <table
                    style={{
                      borderCollapse: "collapse",
                      fontFamily: "Arial",
                      width: "100%",
                      boxSizing: "border-box",
                      textAlign: "center",
                      tableLayout: "fixed",

                    }}
                  >
                    <tbody>
                      {/* TOP ROW: IMAGE (LEFT) + QR (RIGHT) */}
                      <tr>
                        {/* LEFT SIDE */}
                        <td
                          style={{
                            width: "50%",
                            textAlign: "left",
                            paddingLeft: "50px", // ?? margin-left effect
                          }}
                        >
                          {savedUnifast && (
                            <img
                              src={FreeTuitionImage}
                              alt="EARIST MIS FEE"
                              style={{
                                width: "300px",
                                height: "160px",
                              }}
                            />
                          )}
                        </td>

                        {/* RIGHT SIDE */}
                        <td
                          style={{
                            width: "100%",
                            paddingRight: "30px",
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          {hasStudentData && (
                            <img
                              className="qr-code-img"
                              style={{ width: "120px", height: "120px", marginRight: "20px", }}
                              src={`${API_BASE_URL}/uploads/QrCodeGenerated/${student_number}_qrcode.png`}
                              alt="QR Code"
                            />
                          )}
                        </td>
                      </tr>

                      {/* DATE ROW */}
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            height: "0.25in",
                            fontSize: "15px",
                            textAlign: "right",
                            verticalAlign: "middle",
                            paddingRight: "20px",
                          }}
                        >
                          <div style={{
                            color: "black",
                            textAlign: "right",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}>{longDate}</div>
                        </td>
                      </tr>

                      {/* FOOTER */}
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            height: "0.2in",
                            fontSize: "72.5%",
                            backgroundColor: "gray",
                            color: "white",
                          }}
                        >
                          <b>
                            <i
                              style={{
                                color: "black",
                                textAlign: "center",
                                display: "block",
                              }}
                            >
                              KEEP THIS CERTIFICATE. YOU WILL BE REQUIRED TO PRESENT THIS IN ALL
                              YOUR DEALINGS WITH THE COLLEGE.
                            </i>
                          </b>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  },
);

export default CertificateOfRegistration;

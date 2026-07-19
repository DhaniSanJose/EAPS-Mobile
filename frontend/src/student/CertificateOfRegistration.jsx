import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  forwardRef,
} from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import { Box, TextField, Container, Typography } from "@mui/material";
import FreeTuitionImage from "../assets/FreeTuition.png";
import EaristLogo from "../assets/EaristLogo.png";
import "../styles/Print.css";
import { Search } from "@mui/icons-material";
import { FcPrint } from "react-icons/fc";
import { useLocation } from "react-router-dom";
import API_BASE_URL from "../apiConfig";
const CertificateOfRegistration = forwardRef(
  ({ student_number, onReadyChange }, divToPrintRef) => {
    const settings = useContext(SettingsContext);
    const [fetchedLogo, setFetchedLogo] = useState(null);
    const [companyName, setCompanyName] = useState("");
    const [branches, setBranches] = useState([]);

    useEffect(() => {
      if (settings) {
        // ✅ load dynamic logo
        if (settings.logo_url) {
          setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        } else {
          setFetchedLogo(EaristLogo);
        }

        // ✅ load dynamic name + address
        if (settings.company_name) setCompanyName(settings.company_name);
        if (settings?.branches) {
          try {
            const parsed =
              typeof settings.branches === "string"
                ? JSON.parse(settings.branches)
                : settings.branches;
            setBranches(parsed);
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
      cellphoneNumber: "",
      emailAddress: "",
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
      father_family_name: "",
      father_given_name: "",
      father_middle_name: "",
      father_ext: "",
      father_contact: "",
      father_occupation: "",
      father_income: "",
      father_email: "",
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
      generalAverage1: "",
    });

    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");

    const [campusAddress, setCampusAddress] = useState("");

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

          if (data.success) {
            setApprovedBy(data.data);
          }
        } catch (err) {
          console.error(err);
        }
      };

      fetchApprovedBy();
    }, []);

    // ✅ Fetch person data from backend
    const fetchPersonData = async (id) => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/person/${id}`);
        setPerson(res.data); // make sure backend returns the correct format
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

      // Allow Applicant, Admin, SuperAdmin to view ECAT
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
          console.log(res.data.profile_img);
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
      if (personID) {
        fetchProfilePicture(personID);
      }
    }, [personID]);

    useEffect(() => {
      if (personID) {
        console.log("Fetched Data:", data); // SEE what's actually returned
      }
    }, [data]);

    const [shortDate, setShortDate] = useState("");
    const [longDate, setLongDate] = useState("");

    useEffect(() => {
      const updateDates = () => {
        const now = new Date();

        // Format 1: MM/DD/YYYY
        const formattedShort = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;
        setShortDate(formattedShort);

        // Format 2: MM DD, YYYY hh:mm:ss AM/PM
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        const hours = String(now.getHours() % 12 || 12).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        const ampm = now.getHours() >= 12 ? "PM" : "AM";

        const formattedLong = `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} ${ampm}`;
        setLongDate(formattedLong);
      };

      updateDates(); // Set initial values
      const interval = setInterval(updateDates, 1000); // Update every second

      return () => clearInterval(interval); // Cleanup on unmount
    }, []);

    const [courses, setCourses] = useState([]);
    const [enrolled, setEnrolled] = useState([]);
    const [isEnrolledLoaded, setIsEnrolledLoaded] = useState(false);

    const [userId, setUserId] = useState(null); // Dynamic userId
    const [first_name, setUserFirstName] = useState(null); // Dynamic userId
    const [middle_name, setUserMiddleName] = useState(null); // Dynamic userId

    const [last_name, setUserLastName] = useState(null); // Dynamic userId
    const [currId, setCurr] = useState(null); // Dynamic userId
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

    useEffect(() => {
      if (selectedSection) {
        fetchSubjectCounts(selectedSection);
      }
    }, [selectedSection]);

    const fetchSubjectCounts = async (sectionId) => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/subject-enrollment-count`,
          {
            params: { sectionId },
          },
        );

        // Transform into object for easy lookup: { subject_id: enrolled_count }
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
    }, [
      onReadyChange,
      effectiveStudentNumber,
      data,
      userId,
      currId,
      isEnrolledLoaded,
    ]);

    // Fetch department sections when component mounts
    useEffect(() => {
      fetchDepartmentSections();
    }, []);

    // Fetch sections whenever selectedDepartment changes
    useEffect(() => {
      if (selectedDepartment) {
        fetchDepartmentSections();
      }
    }, [selectedDepartment]);

    // Fetch department sections based on selected department
    const fetchDepartmentSections = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${API_BASE_URL}/api/department-sections`,
          {
            params: { departmentId: selectedDepartment },
          },
        );
        // Artificial delay
        setTimeout(() => {
          setSections(response.data);
          setLoading(false);
        }, 700); // 3 seconds delay
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

    useEffect(() => {
      if (!effectiveStudentNumber) return; // don't run if empty

      const fetchStudent = async () => {
        try {
          // 1. Authenticate and tag student
          const response = await axios.post(
            `${API_BASE_URL}/api/student-tagging`,
            { studentNumber: effectiveStudentNumber },
            {
              headers: { "Content-Type": "application/json" },
            },
          );

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

          console.log(course_unit);

          // Save to localStorage
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

          // Update state variables
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
          setYearDescription(yearDesc);

          console.log(yearLevelDescription);

          const fullData = {
            ...(response.data.corData || {}),
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
          setData([fullData]); // Wrap in array for data[0] compatibility

          setGender(fullData.gender ?? null);
          setAge(fullData.age ?? null);
          console.log(age);
          console.log(major);
          console.log("person.program:", data[0]?.program);
          setEmail(fullData.email || fullData.emailAddress || null);
          setProgram(active_curriculum);
        } catch (error) {
          console.error("Student search failed:", error);
        }
      };

      fetchStudent();
    }, [effectiveStudentNumber]); // 🔑 runs automatically when prop changes

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
    }, [
      effectiveStudentNumber,
      savedUnifast,
      savedMatriculation,
      isPaymentStatusLoaded,
    ]);

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

    // Fetch all departments when component mounts
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

    const toWholeUnit = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num) : 0;
    };
    // Keep subject cells transform-free so html2canvas / PDF capture stays vertically centered
    const subjectCellContentStyle = {
      width: "100%",
      height: "26px",
      lineHeight: "26px",
      border: "none",
      background: "none",
      padding: "0 3px",
      margin: 0,
      boxSizing: "border-box",
      verticalAlign: "middle",
      display: "block",
    };
    const subjectCellTdStyle = {
      borderRight: "1px solid black",
      borderBottom: "1px solid black",
      verticalAlign: "middle",
      height: "28px",
      padding: 0,
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
    const corAssessedFeeRows = [
      {
        label: `Tuition (${totalCombined || 0} unit(s))`,
        value: selectedPaymentData?.tuition_fees,
      },
      { label: "Athletic Fee", value: selectedPaymentData?.athletic_fees },
      { label: "Cultural Fee", value: selectedPaymentData?.cultural_fees },
      {
        label: "Development Fee",
        value: selectedPaymentData?.development_fees,
      },
      { label: "Guidance Fee", value: selectedPaymentData?.guidance_fees },
      { label: "Library Fee", value: selectedPaymentData?.library_fees },
      {
        label: "Medical and Dental Fee",
        value: selectedPaymentData?.medical_and_dental_fees,
      },
      {
        label: "Registration Fee",
        value: selectedPaymentData?.registration_fees,
      },
      { label: "Computer Fee", value: selectedPaymentData?.computer_fees },
    ];
    const corAssessmentRows = [
      { label: "Total Assessment", value: selectedPaymentData?.total_tosf },
      { label: "Less Financial Aid", value: "" },
      { label: "Net Assessed", value: "" },
      { label: "Credit Memo", value: "" },
      { label: "Total Discount", value: "" },
      { label: "Total Payment", value: "" },
      { label: "Outstanding Balance", value: "" },
    ];
    const corRefundRules = [
      "1. Full refund of tuition fee - Before the start of classes.",
      "2. 80% refund of tuition fee - within 1 week from the start of classes.",
      "3. 50% refund - within 2 weeks from the start of classes.",
      "4. No refund - after the 2nd week of classes.",
    ];
    const formatGender = (value) => {
      if (value === null || value === undefined || value === "") return "";
      if (Number(value) === 0) return "Male";
      if (Number(value) === 1) return "Female";
      return value || "";
    };

    const [curriculumOptions, setCurriculumOptions] = useState([]);

    useEffect(() => {
      const fetchCurriculums = async () => {
        try {
          const response = await axios.get(
            `${API_BASE_URL}/api/applied_program`,
          );
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
          item?.curriculum_id?.toString() ===
          (person?.program ?? "").toString(),
      )?.program_description ||
        (person?.program ?? "");
    }

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
      <Container
        maxWidth={false}
        disableGutters
        className="mb-[4rem]"
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 4,
        }}
      >
        <div className="flex-container">
          <div className="section">
            <Box></Box>

            <div ref={divToPrintRef} className="certificate-wrapper">
              {/* Watermark across the page */}
              <div className="certificate-watermark">STUDENT COPY</div>

              <style>{`
    .certificate-wrapper {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: white;
      overflow: visible;
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
      @page {
        size: A4;
        margin: 0;
      }

      .certificate-wrapper {
        width: 210mm;
        min-height: 297mm;
      }

      .certificate-watermark {
        color: rgba(0, 0, 0, 0.15); /* a bit darker so it prints */
      }
      button {
        display: none;
      }
    }

    .cor-fees-start input,
    .cor-fees-start ~ tr input,
    .cor-fees-start td > i,
    .cor-fees-start ~ tr td > i {
      transform: translateY(-10px);
      display: inline-block;
    }

    .cor-student-info-row input,
    .cor-student-info-row td > b {
      transform: translateY(-5px);
      display: inline-block;
    }

    .cor-subject-header-row td > div {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      margin: 0;
      transform: none;
    }

    .cor-subject-subheader-row .cor-content-offset,
    .cor-subject-total-row .cor-content-offset {
      display: inline-block;
      transform: none;
      line-height: 1.2;
      vertical-align: middle;
    }

    .cor-subject-data-row td {
      vertical-align: middle !important;
    }

    .cor-subject-data-row input {
      transform: none !important;
    }

    .cor-lower-extra input,
    .cor-lower-extra img,
    .cor-lower-extra i {
      transform: translateY(-10px);
      display: inline-block;
    }

    .cor-student-general-info .cor-student-info-row input {
      transform: translateY(-10px);
    }

    .cor-student-general-info .cor-shift-left-label {
      transform: translate(-16px, -10px);
    }

    .cor-student-general-info .cor-left-value-wide {
      width: calc(98% + 35px) !important;
    }

    .cor-student-general-info .cor-content-offset {
      white-space: nowrap;
    }

    .cor-fees-start,
    .cor-fees-start ~ tr {
      display: none;
    }

    .cor-fees-div-row td {
      padding: 0;
      border-right: 1px solid black;
    }

    .cor-fees-div-layout {
      display: grid;
      grid-template-columns: 20fr 22fr;
      width: 100%;
      min-height: 4.05in;
      font-family: Arial;
      color: black;
      transform: translateY(-5px);
    }

    .cor-fees-left {
      text-align: left;
    }

    .cor-fees-title {
      height: 0.18in;
      line-height: 0.18in;
      background: gray;
      border-top: 1px solid black;
      border-left: 1px solid black;
      border-right: 1px solid black;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 4px;
      text-align: center;
      position: relative;
      box-sizing: border-box;
    }

    .cor-assessed-title {
      width: 100%;
      border-bottom: 1px solid black;
    }

    .cor-schedule-title,
    .cor-payment-grid {
      margin-left: -4px;
      margin-right: -8px;
      width: auto;
      box-sizing: border-box;
    }

    .cor-schedule-title {
      margin-left: -4px;
      margin-right: -8px;
      margin-top: 8px;
      width: auto;
    }

    .cor-schedule-title::before {
      content: "";
      position: absolute;
      top: -8px;
      left: -1px;
      right: -1px;
      height: 8px;
      border-left: 1px solid black;
      border-right: 1px solid black;
      box-sizing: border-box;
    }

    .cor-fees-title span {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .cor-fees-body {
      padding: 0 8px 0 4px;
      text-align: left;
    }

    .cor-assessment-content {
      margin-left: -4px;
      margin-right: -8px;
      padding: 4px 8px 0 4px;
      border-left: 1px solid black;
      border-right: 1px solid black;
    }

    .cor-fee-line,
    .cor-assessment-line {
      display: grid;
      grid-template-columns: 1fr 72px;
      align-items: center;
      min-height: 15px;
      font-size: 12px;
      font-weight: bold;
      line-height: 1;
      width: 100%;
    }

    .cor-fee-line span:first-child,
    .cor-assessment-line span:first-child {
      text-align: left;
    }

    .cor-fee-line span:last-child,
    .cor-assessment-line span:last-child {
      text-align: right;
    }

    .cor-assessment-list {
      margin-top: 14px;
      padding-left: 54px;
    }

    .cor-payment-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-top: 1px solid black;
      border-bottom: 1px solid black;
      border-left: 1px solid black;
      border-right: 1px solid black;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
    }

    .cor-payment-cell {
      min-height: 16px;
      border-right: 1px solid black;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .cor-payment-cell:nth-child(3n) {
      border-right: 0;
    }

    .cor-payment-cell span {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .cor-payment-value {
      min-height: 16px;
      border-top: 1px solid black;
      position: relative;
    }

    .cor-payment-value span {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .cor-payment-footer {
      display: grid;
      grid-template-columns: 172px 1fr;
      row-gap: 1px;
      column-gap: 8px;
      margin-left: -4px;
      margin-right: -8px;
      padding-top: 2px;
      box-sizing: border-box;
      font-size: 11px;
      font-weight: bold;
      align-items: end;
    }

    .cor-payment-label {
      display: flex;
      align-items: center;
      min-height: 22px;
      white-space: nowrap;
    }

    .cor-fee-stamp-row {
      display: none;
    }

    .cor-line-value {
      border-bottom: 1px solid black;
      text-align: center;
      min-height: 22px;
    }

    .cor-fees-right {
      padding: 12px 12px 0;
      text-align: center;
      font-size: 10px;
      font-weight: bold;
    }

    .cor-refund-title,
    .cor-pledge-title {
      font-weight: bold;
      text-align: center;
      font-size: 10px;
      line-height: 1.1;
    }

    .cor-refund-list {
      margin: 4px auto 12px;
      width: 92%;
      text-align: left;
      font-size: 9px;
      font-style: italic;
      line-height: 1.35;
    }

    .cor-pledge-copy {
      width: 90%;
      margin: 4px auto 0;
      font-size: 9px;
      font-style: italic;
      line-height: 1.25;
    }

    .cor-student-signature {
      width: 68%;
      margin: 44px auto 0;
      border-top: 1px solid black;
      padding-top: 2px;
      line-height: 12px;
    }

    .cor-approval-row {
      position: relative;
      margin-top: 38px;
    }

    .cor-approved-block {
      position: absolute;
      left: 21px;
      top: 31px;
      line-height: 12px;
      text-align: left;
      white-space: nowrap;
    }

    .cor-registrar-signature {
      width: 76%;
      margin: 0 auto;
      text-align: center;
    }

    .cor-registrar-signature-slot {
      height: 31px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .cor-registrar-signature-image {
      height: 38px;
      object-fit: contain;
      width: 150px;
      display: block;
      margin-bottom: -6px;
    }

    .cor-registrar-line {
      width: 94%;
      margin: 4px auto 0;
      border-top: 1px solid black;
      height: 0;
    }

    .cor-registrar-name {
      height: 12px;
      line-height: 12px;
      font-weight: bold;
    }

    .cor-registrar-role {
      margin-top: 1px;
      line-height: 11px;
    }

    .cor-lower-extra {
      margin-top: -8px !important;
    }

    .cor-lower-extra-stamp-row {
      height: 1.9in;
      vertical-align: bottom;
    }

    .cor-free-tuition-cell {
      vertical-align: bottom;
    }

    .cor-free-tuition-stamp {
      width: 345px;
      height: 200px;
      object-fit: contain;
      display: block;
      margin: 0 0 4px 10px;
    }

    .cor-qr-code-img {
      width: 125px;
      height: 125px;
      object-fit: contain;
      display: block;
      margin-left: auto;
      margin-right: 28px;
    }

    .cor-footer-time {
      height: 0.2in;
      font-size: 14px;
      text-align: right;
      vertical-align: bottom;
    }
  `}</style>

              <div className="section">
                <table
                  className="student-table"
                  style={{
                    borderCollapse: "collapse",
                    fontFamily: "Arial",
                    width: "8in",
                    marginTop: "-20px",
                    margin: "0 auto", // Center the table inside the form
                    textAlign: "center",
                    tableLayout: "fixed",
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
                        style={{ height: "0.1in", fontSize: "62.5%" }}
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
                                  crossOrigin="anonymous"
                                  alt="School Logo"
                                  style={{
                                    marginLeft: "10px",
                                    width: "140px",
                                    height: "140px",
                                    borderRadius: "50%", // ✅ makes it circular
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
                                {campusAddress && (
                                  <div
                                    style={{
                                      fontSize: "13px",
                                      fontFamily: "Arial",
                                    }}
                                  >
                                    {campusAddress}
                                  </div>
                                )}

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
                                    width: "3.80cm",
                                    height: "3.80cm",
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
                                      crossOrigin="anonymous"
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
                                        fontSize: "12px",
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

                    <tr className="cor-student-info-row">
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
                            fontSize: "12px",
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
                          <span style={{ color: "red" }}></span>
                        </b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table
                  className="cor-student-general-info"
                  style={{
                    borderLeft: "1px solid black",
                    borderTop: "1px solid black",
                    borderRight: "1px solid black",
                    borderCollapse: "collapse",
                    fontFamily: "Arial",
                    width: "8in",
                    margin: "0 auto", // Center the table inside the form
                    textAlign: "center",
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
                              fontSize: "12px",
                              textAlign: "center",
                              display: "block",
                            }}
                          >
                            <span className="cor-content-offset">
                              STUDENT GENERAL INFORMATION
                            </span>
                          </b>
                        </b>
                      </td>
                    </tr>

                    <tr className="cor-student-info-row">
                      <td colSpan={4} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          type="text"
                          value="Student No:"
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      <td colSpan={14} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          className="cor-left-value-wide"
                          type="text"
                          value={data[0]?.student_number || ""}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      <td colSpan={4} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value="College:"
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      {/* College Display */}
                      <td colSpan={14} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value={data[0]?.college || ""}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>

                    <tr className="cor-student-info-row" >
                      {/* Name Label */}
                      <td colSpan={4} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          type="text"
                          value="Name:"
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      {/* Name Value */}
                      <td colSpan={14} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          className="cor-left-value-wide"
                          type="text"
                          value={`${data[0]?.last_name || ""}, ${data[0]?.first_name || ""} ${data[0]?.middle_name || ""} ${data[0]?.extension || ""}`.trim()}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      {/* Program Label */}
                      <td colSpan={4} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value="Program:"
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      <td colSpan={20} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value={(() => {
                            const match = curriculumOptions.find(
                              (item) =>
                                item?.curriculum_id?.toString() ===
                                (data[0]?.program ?? "").toString(),
                            );
                            return match
                              ? match.program_description
                              : (data[0]?.program ?? "");
                          })()}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>

                    <tr className="cor-student-info-row">
                      {/* Gender Label */}
                      <td colSpan={4} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          type="text"
                          value="Gender:"
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      {/* Gender Value */}
                      <td colSpan={14} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          className="cor-left-value-wide"
                          type="text"
                          value={formatGender(data[0]?.gender)}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      {/* Major Label */}
                      <td colSpan={4} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value="Major:"
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td colSpan={6} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          readOnly
                          value={
                            major
                              ? major.charAt(0).toUpperCase() +
                              major.slice(1).toLowerCase()
                              : ""
                          }
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      {/* Curriculum Label */}
                      <td colSpan={5} style={{ fontSize: "62.5%" }}>
                        <input
                          className="cor-shift-left-label"
                          type="text"
                          value="Curriculum:"
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      {/* Curriculum Value */}
                      <td colSpan={9} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value={`${year_desc || ""}-${year_desc || ""}`}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>

                    <tr className="cor-student-info-row">
                      <td colSpan={4} style={{ fontSize: "50%", padding: "0px 8px" }}>
                        <input
                          readOnly
                          type="text"
                          value={"Age:"}
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td colSpan={14} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          className="cor-left-value-wide"
                          type="text"
                          value={data[0]?.age || ""}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td colSpan={4} style={{ fontSize: "50%" }}>
                        <input
                          readOnly
                          type="text"
                          value={"Year Level:"}
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td colSpan={6} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value={year_Level_Description || ""}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            marginLeft: "5px",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td colSpan={8} style={{ fontSize: "50%" }}>
                        <input
                          className="cor-shift-left-label"
                          type="text"
                          value={"Scholarship/Discount:"}
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "black",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td colSpan={6} style={{ fontSize: "62.5%" }}>
                        <input
                          type="text"
                          value={scholarshipDiscountValue}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>

                    <tr className="cor-student-info-row">
                      <td colSpan={5} style={{ fontSize: "50%", padding: "0px 8px" }}>
                        <input
                          type="text"
                          value={"Email Address:"}
                          readOnly
                          style={{
                            color: "black",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            width: "98%",
                            border: "none",
                            height: "28px",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td colSpan={12} style={{ fontSize: "62.5%", padding: "0px 8px" }}>
                        <input
                          className="cor-left-value-wide"
                          type="text"
                          value={data[0]?.email || ""}
                          readOnly
                          style={{
                            fontFamily: "Arial",
                            color: "black",
                            width: "98%",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                            height: "28px",
                          }}
                        />
                      </td>
                    </tr>

                    {/*----------------------------------------------------------------------------------------------------------------------------------*/}

                    <tr className="cor-subject-header-row">
                      <td
                        colSpan={5.5}
                        rowSpan={2}
                        style={{
                          color: "black",
                          height: "0.3in",
                          fontFamily: "Arial",
                          fontSize: "12px",
                          fontWeight: "bold",

                          backgroundColor: "gray",
                          borderTop: "1px solid black",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
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
                        colSpan={11}
                        rowSpan={2}
                        style={{
                          color: "black",
                          height: "0.3in",
                          fontFamily: "Arial",
                          fontSize: "12px",
                          fontWeight: "bold",
                          backgroundColor: "gray",
                          borderTop: "1px solid black",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
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
                          fontSize: "12px",
                          fontWeight: "bold",

                          backgroundColor: "gray",
                          borderTop: "1px solid black",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
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
                          fontSize: "12px",
                          fontWeight: "bold",

                          backgroundColor: "gray",
                          borderTop: "1px solid black",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
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
                          fontSize: "12px",
                          fontWeight: "bold",
                          backgroundColor: "gray",
                          borderTop: "1px solid black",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
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
                          fontSize: "12px",
                          fontWeight: "bold",
                          backgroundColor: "gray",
                          borderTop: "1px solid black",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
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
                    <tr className="cor-subject-subheader-row">
                      <td
                        colSpan={1}
                        style={{
                          color: "black",
                          height: "0.1in",
                          fontSize: "50%",
                          backgroundColor: "gray",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
                          textAlign: "center",
                        }}
                      >
                        <span className="cor-content-offset">Lec</span>
                      </td>
                      <td
                        colSpan={1}
                        style={{
                          color: "black",
                          height: "0.1in",
                          fontSize: "50%",
                          backgroundColor: "gray",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
                          textAlign: "center",
                        }}
                      >
                        <span className="cor-content-offset">Lab</span>
                      </td>
                      <td
                        colSpan={2}
                        style={{
                          color: "black",
                          height: "0.1in",
                          fontSize: "50%",
                          backgroundColor: "gray",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
                          textAlign: "center",
                        }}
                      >
                        <span className="cor-content-offset">Credit</span>
                      </td>
                      <td
                        colSpan={2}
                        style={{
                          color: "black",
                          height: "0.1in",
                          fontSize: "50%",
                          backgroundColor: "gray",
                          borderRight: "1px solid black",
                          borderBottom: "1px solid black",
                          textAlign: "center",
                        }}
                      >
                        <span className="cor-content-offset">Tuition</span>
                      </td>
                    </tr>
                    {enrolled.map((item, index) => (
                      <tr key={index} className="cor-subject-data-row">
                        <td colSpan={5.5} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={item.course_code || ""}
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "12px",
                            }}
                          />
                        </td>
                        <td colSpan={11} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={item.course_description || ""}
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "left",
                              fontSize: "11px",
                              padding: "0 5px",
                            }}
                          />
                        </td>
                        <td colSpan={1} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={
                              item.course_unit == null
                                ? ""
                                : toWholeUnit(item.course_unit)
                            }
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "12px",
                            }}
                          />
                        </td>
                        <td colSpan={1} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={
                              item.lab_unit == null
                                ? ""
                                : toWholeUnit(item.lab_unit)
                            }
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "12px",
                            }}
                          />
                        </td>
                        <td colSpan={2} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={
                              toWholeUnit(item.course_unit) +
                              toWholeUnit(item.lab_unit)
                            }
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "12px",
                            }}
                          />
                        </td>
                        <td colSpan={2} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={
                              toWholeUnit(item.course_unit) +
                              toWholeUnit(item.lab_unit)
                            }
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "12px",
                            }}
                          />
                        </td>
                        <td colSpan={4} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={item.description || ""}
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "10px",
                            }}
                          />
                        </td>
                        <td colSpan={8} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={`${item.day_description || ""} ${item.school_time_start || ""
                              }-${item.school_time_end || ""}`.trim()}
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "8px",
                            }}
                          />
                        </td>
                        <td colSpan={8} style={subjectCellTdStyle}>
                          <input
                            type="text"
                            value={`Prof. ${item.lname || "TBA"}`}
                            readOnly
                            style={{
                              ...subjectCellContentStyle,
                              textAlign: "center",
                              fontSize: "8px",
                            }}
                          />
                        </td>
                      </tr>
                    ))}

                    {/*----------------------------------------------------------------------------------------------------------------------------------*/}

                    <tr className="cor-subject-total-row">
                      <td
                        colSpan={10}
                        style={{
                          height: "0.22in",
                          fontSize: "45%",
                          color: "black",
                          textAlign: "left",
                          verticalAlign: "middle",
                          padding: "0 4px",
                        }}
                      >
                        <span className="cor-content-offset">
                          <b>Note: Subject marked with "*" is Special Subject</b>
                        </span>
                      </td>
                      <td
                        colSpan={6}
                        style={{
                          height: "0.22in",
                          fontSize: "50%",
                          color: "black",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <span className="cor-content-offset">
                          <b>Total Unit(s)</b>
                        </span>
                      </td>
                      <td
                        colSpan={1}
                        style={{
                          height: "0.22in",
                          fontSize: "12px",
                          color: "black",
                          fontFamily: "Arial",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <span className="cor-content-offset">
                          {totalCourseUnits}
                        </span>
                      </td>
                      <td
                        colSpan={1}
                        style={{
                          height: "0.22in",
                          fontSize: "12px",
                          color: "black",
                          fontFamily: "Arial",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <span className="cor-content-offset">
                          {totalLabUnits}
                        </span>
                      </td>
                      <td
                        colSpan={2}
                        style={{
                          height: "0.22in",
                          fontSize: "12px",
                          color: "black",
                          fontFamily: "Arial",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <span className="cor-content-offset">
                          {totalCourseUnits + totalLabUnits}
                        </span>
                      </td>
                      <td
                        colSpan={2}
                        style={{
                          height: "0.22in",
                          fontSize: "12px",
                          color: "black",
                          fontFamily: "Arial",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <span className="cor-content-offset">
                          {totalCombined}
                        </span>
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
                    <tr className="cor-fees-div-row">
                      <td colSpan={42}>
                        <div className="cor-fees-div-layout" style={{ marginTop: "5px", marginLeft: "7px" }}>
                          <div className="cor-fees-left">
                            <div className="cor-fees-title cor-assessed-title">
                              <span style={{ marginTop: "-3px" }}>ASSESSED FEES</span>
                            </div>
                            <div className="cor-fees-body">
                              <div className="cor-assessment-content">
                                {corAssessedFeeRows.map((fee) => (
                                  <div className="cor-fee-line" key={fee.label}>
                                    <span>{fee.label}</span>
                                    <span>{formatFee(fee.value)}</span>
                                  </div>
                                ))}

                                <div className="cor-assessment-list">
                                  {corAssessmentRows.map((row) => (
                                    <div
                                      className="cor-assessment-line"
                                      key={row.label}
                                    >
                                      <span>{row.label} :</span>
                                      <span>{formatFee(row.value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="cor-fees-title cor-schedule-title">
                                <span style={{ marginTop: "-3px", width: "100%" }}>SCHEDULE OF PAYMENT</span>
                              </div>
                              <div className="cor-payment-grid">
                                {[
                                  "1st Payment/Due",
                                  "2nd Payment/Due",
                                  "3rd Payment/Due",
                                ].map((label) => (
                                  <div className="cor-payment-cell" key={label}>
                                    <span style={{ marginTop: "-5px", width: "100%" }}>{label}</span>
                                  </div>
                                ))}
                                {[0, 1, 2].map((item) => (
                                  <div
                                    className="cor-payment-cell cor-payment-value"
                                    key={item}
                                  >
                                    <span style={{ marginTop: "-5px" }}>0.00</span>
                                  </div>
                                ))}
                              </div>
                              <div className="cor-payment-footer">
                                <span className="cor-payment-label">Payment/Validation Date :</span>
                                <span className="cor-line-value">
                                  <span>{shortDate}</span>
                                </span>
                                <span className="cor-payment-label">Official Receipt :</span>
                                <span className="cor-line-value">
                                  <span>{officialReceiptValue}</span>
                                </span>
                              </div>
                              <div className="cor-fee-stamp-row">
                              </div>
                            </div>
                          </div>

                          <div className="cor-fees-right">
                            <div className="cor-refund-title">
                              RULES OF REFUND
                            </div>
                            <div className="cor-refund-list">
                              {corRefundRules.map((rule) => (
                                <div key={rule}>{rule}</div>
                              ))}
                            </div>

                            <div className="cor-pledge-title">
                              PLEDGE UPON ADMISSION
                            </div>
                            <div className="cor-pledge-copy" >
                              "As a student of EARIST, I do solemnly promise
                              that I will comply with the rules and regulations
                              of the Institution."
                            </div>

                            <div className="cor-student-signature">
                              Student's Signature
                            </div>

                            <div className="cor-approval-row">
                              <div className="cor-approved-block">
                                APPROVED BY :
                              </div>

                              <div className="cor-registrar-signature">
                                <div className="cor-registrar-signature-slot" style={{ height: "60px" }}>
                                  {showApprovedBySignature && (
                                    <img
                                      src={approvedBySignatureUrl}
                                      crossOrigin="anonymous"
                                      alt="Signature"
                                      className="cor-registrar-signature-image"
                                      onError={() =>
                                        setApprovedBySignatureMissing(true)
                                      }
                                    />
                                  )}
                                </div>
                                <div className="cor-registrar-name">
                                  {approvedBy?.full_name || ""}
                                </div>
                                <div className="cor-registrar-line"></div>
                                <div className="cor-registrar-role">Registrar</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr className="cor-fees-start">
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
                        <input
                          type="text"
                          value={"A S S E S S E D  F E E S"}
                          readOnly
                          style={{
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
                          }}
                        />
                      </td>
                      <td
                        colSpan={8}
                        style={{
                          color: "white",
                          fontSize: "62.5%",
                          color: "black",
                          border: "1px 0px 1px 1px solid black",
                          textAlign: "center",
                        }}
                      ></td>
                    </tr>

                    <tr>
                      <td colSpan={15} style={{ padding: 0 }}>
                        <input
                          type="text"
                          value={"Tuition (21 unit(s)) "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "60.5%",
                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(selectedPaymentData?.tuition_fees)}
                          readOnly
                          style={{
                            textAlign: "center",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "black",
                            width: "100%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"RULES OF REFUND"}
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            marginLeft: "40px",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "10px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr></tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Athletic Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(selectedPaymentData?.athletic_fees)}
                          readOnly
                          style={{
                            textAlign: "center",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={
                            "1. Full refund of tuition fee - Before the start of classes."
                          }
                          readOnly
                          style={{
                            textAlign: "left",
                            color: "black",
                            marginLeft: "40px",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "10px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                            fontStyle: "italic",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Cultural Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(selectedPaymentData?.cultural_fees)}
                          readOnly
                          style={{
                            textAlign: "center",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={20}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={
                            "2. 80% refund of tuition fee - within 1 week from the start of classes."
                          }
                          readOnly
                          style={{
                            textAlign: "left",
                            color: "black",
                            marginLeft: "40px",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "10px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                            fontStyle: "italic",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Developmental Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(
                            selectedPaymentData?.development_fees,
                          )}
                          readOnly
                          style={{
                            textAlign: "center",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={
                            "3. 50% refund - within 2 weeks from the start of classes."
                          }
                          readOnly
                          style={{
                            textAlign: "left",
                            color: "black",
                            marginLeft: "40px",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "10px",
                            fontWeight: "bold",
                            outline: "none",
                            fontStyle: "italic",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Guidance Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(selectedPaymentData?.guidance_fees)}
                          readOnly
                          style={{
                            textAlign: "center",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "black",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={
                            "4. No refund - after the 2nd week of classes."
                          }
                          readOnly
                          style={{
                            textAlign: "left",
                            color: "black",
                            marginLeft: "40px",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "10px",
                            fontWeight: "bold",
                            outline: "none",
                            fontStyle: "italic",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Library Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(selectedPaymentData?.library_fees)}
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Medical and Dental Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(
                            selectedPaymentData?.medical_and_dental_fees,
                          )}
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={20}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"PLEDGE UPON ADMISSION"}
                          readOnly
                          style={{
                            fontWeight: "bold",
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Registration Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(
                            selectedPaymentData?.registration_fees,
                          )}
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={20}
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "black",
                          fontFamily: "Arial",
                          fontSize: "10px",
                        }}
                      >
                        <i>
                          {" "}
                          "As a student of EARIST, I do solemnly promise that I
                          will{" "}
                        </i>
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Computer Fee"}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(selectedPaymentData?.computer_fees)}
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={20}
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "black",
                          fontFamily: "Arial",
                          fontSize: "10px",
                        }}
                      >
                        <i>
                          comply with the rules and regulations of the
                          Institution."
                        </i>
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={13}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            textAlign: "left",
                            color: "black",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          marginRight: "20px",
                        }}
                      ></td>
                      <td
                        colSpan={13}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Total Assessment : "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={formatFee(selectedPaymentData?.total_tosf)}
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>

                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          marginRight: "20px",
                        }}
                      ></td>
                      <td
                        colSpan={13}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Less Financial Aid : "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          marginRight: "20px",
                        }}
                      ></td>
                      <td
                        colSpan={13}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Net Assessed : "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      <td colSpan={20}>
                        <input
                          type="text"
                          value={"_________________________________"}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            textDecoration: "underline",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          marginRight: "20px",
                        }}
                      ></td>
                      <td
                        colSpan={13}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Credit Memo : "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>

                      <td colSpan={20}>
                        <input
                          type="text"
                          value={"Student's Signature"}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          marginRight: "20px",
                        }}
                      ></td>
                      <td
                        colSpan={13}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Total Discount : "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          marginRight: "20px",
                        }}
                      ></td>
                      <td
                        colSpan={13}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Total Payment : "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={5}
                        style={{
                          fontSize: "62.5%",
                          marginRight: "20px",

                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            textAlign: "center",
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          marginRight: "20px",
                        }}
                      ></td>
                      <td
                        colSpan={18}
                        style={{
                          fontSize: "62.5%",
                          borderRight: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={"Outstanding Balance : "}
                          readOnly
                          style={{
                            color: "black",
                            width: "98%",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={7}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"APPROVED BY : "}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "left",
                            marginLeft: "20px",
                            fontWeight: "bold",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          fontSize: "62.5%",
                          border: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={"1st Payment/Due"}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            fontWeight: "bold",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={6}
                        style={{
                          border: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={"2nd Payment/Due"}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={7}
                        style={{
                          border: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          value={"3rd Payment/Due"}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={20}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        {showApprovedBySignature ? (
                          <img
                            src={approvedBySignatureUrl}
                            crossOrigin="anonymous"
                            alt="Signature"
                            onError={() =>
                              setApprovedBySignatureMissing(true)
                            }
                            style={{
                              height: "60px",
                              objectFit: "contain",
                              width: "250px",
                              marginBottom: "2px",
                              display: !effectiveStudentNumber
                                ? "none"
                                : "block",
                              marginLeft: "auto",
                              marginRight: "auto",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: "60px",
                              display: !effectiveStudentNumber
                                ? "none"
                                : "block",
                            }}
                          />
                        )}

                        <div
                          style={{
                            display: "inline-block",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            marginTop: "-10px",
                            fontWeight: "bold",
                            lineHeight: "1.1",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              minHeight: "14px",
                              display: !effectiveStudentNumber
                                ? "none"
                                : "block",
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
                      <td
                        colSpan={7}
                        style={{
                          fontSize: "62.5%",
                          border: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            color: "black",
                            fontWeight: "bold",
                            textAlign: "center",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={6}
                        style={{
                          fontSize: "62.5%",
                          border: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            fontWeight: "bold",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={7}
                        style={{
                          fontSize: "62.5%",
                          border: "1px solid black",
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            width: "98%",
                            fontWeight: "bold",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={20}
                        style={{
                          fontSize: "12px",
                        }}
                      >
                        <input
                          type="text"
                          value={"Registrar"}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            width: "98%",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            fontWeight: "bold",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                    </tr>

                    <tr>
                      <td
                        colSpan={12}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Payment/Validation Date : "}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            width: "98%",
                            fontWeight: "bold",
                            textDecorationThickness: "2px", // <-- Thicker underline

                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={8}
                        style={{
                          height: "0.25in",
                          fontSize: "12px",
                          fontFamily: "Arial",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <input
                          type="text"
                          value={shortDate}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            width: "100%", // ensures full-width underline
                            border: "none",
                            outline: "none",

                            fontWeight: "bold",
                            background: "none",
                            borderBottom: "1px solid black", // thicker, longer underline
                          }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          fontSize: "62.5%",
                        }}
                      >
                        <input
                          type="text"
                          value={"Official Receipt :"}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            width: "98%",
                            fontWeight: "bold",
                            border: "none",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            outline: "none",
                            background: "none",
                          }}
                        />
                      </td>
                      <td
                        colSpan={10}
                        style={{
                          fontSize: "62.5%",
                          textAlign: "center",
                          fontWeight: "Bold",
                        }}
                      >
                        <input
                          type="text"
                          value={officialReceiptValue}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "center",
                            width: "95%",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            fontSize: "12px",
                            border: "none",
                            outline: "none",
                            background: "none",
                            borderBottom: "1px solid black", // underlines the field like a line
                          }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table
                  className="cor-lower-extra"
                  style={{
                    borderCollapse: "collapse",
                    fontFamily: "Arial",
                    width: "8in",
                    margin: "0 auto", // Center the table inside the form
                    textAlign: "center",
                    tableLayout: "fixed",
                    borderLeft: "1px solid black",
                    borderBottom: "1px solid black",
                    borderRight: "1px solid black",
                  }}
                >
                  <tbody>
                    <tr className="cor-lower-extra-stamp-row">
                      <td
                        className="cor-free-tuition-cell"
                        style={{ width: "50%", textAlign: "left", position: "relative" }}
                      >
                        {showFreeTuitionStamp && (
                          <img
                            src={FreeTuitionImage}
                            crossOrigin="anonymous"
                            alt="EARIST MIS FEE"
                            className="cor-free-tuition-stamp"
                            style={{
                              position: "absolute",
                              top: "40px",
                              left: "-10px",
                            }}
                          />
                        )}
                      </td>
                      <td style={{ width: "50%", textAlign: "right" }}>
                        {effectiveStudentNumber && !qrCodeMissing && (
                          <img
                            src={`${API_BASE_URL}/uploads/QrCodeGenerated/${effectiveStudentNumber}_qrcode.png`}
                            crossOrigin="anonymous"
                            alt="Student QR Code"
                            className="cor-qr-code-img"
                            onError={() => setQrCodeMissing(true)}
                          />
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td
                        colSpan={2}
                        className="cor-footer-time"
                      >
                        <input
                          type="text"
                          value={longDate}
                          readOnly
                          style={{
                            color: "black",
                            textAlign: "right",
                            width: "98%",
                            border: "none",
                            outline: "none",
                            background: "none",
                            fontSize: "10px",
                            letterSpacing: "-0.5px",
                            fontFamily: "Arial",
                            fontWeight: "bold",
                            marginRight: "10px",
                          }}
                        />
                      </td>
                    </tr>

                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          height: "0.2in",
                          fontSize: "72.5%",
                          backgroundColor: "gray",
                          color: "white",
                          position: "relative",
                        }}
                      >
                        <b>
                          <span
                            style={{
                              color: "black",
                              textAlign: "center",
                              display: "block",
                              position: "absolute",
                              fontSize: "10px",
                              letterSpacing: "-0.5px",
                              fontFamily: "Arial",
                              fontWeight: "bold",
                              top: "-2px",
                              width: "100%",
                              left: "50%",
                              transform: "translateX(-50%)",
                            }}
                          >
                            KEEP THIS CERTIFICATE. YOU WILL BE REQUIRED TO
                            PRESENT THIS IN ALL YOUR DEALINGS WITH THE COLLEGE.
                          </span>
                        </b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  },
);

export default CertificateOfRegistration;

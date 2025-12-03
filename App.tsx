import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Bell, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  PenTool, 
  X,
  Clock,
  CheckSquare,
  User,
  CheckCircle,
  Circle,
  Users,
  Crown,
  Palette,
  Eraser,
  RefreshCw,
  School,
  LogOut,
  CalendarDays,
  Image as ImageIcon,
  Upload,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  BrainCircuit,
  Smartphone,
  Settings,
  Copy,
  Edit3,
  Briefcase
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  updateDoc,
  getDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  where,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

// --- Global Variable Handling for Gemini Preview ---
const firebaseConfig = {
  apiKey: "AIzaSyADmdvPfLNnwfPIN5L7qwBr-9vpJOYYuuc",
  authDomain: "class-management-956f3.firebaseapp.com",
  projectId: "class-management-956f3",
  storageBucket: "class-management-956f3.firebasestorage.app",
  messagingSenderId: "975995863182",
  appId: "1:975995863182:web:6f873ffe2eba558d7909df",
  measurementId: "G-YT3LQHQ4N8"
};

const validConfig = typeof (window as any).__firebase_config !== 'undefined' 
  ? JSON.parse((window as any).__firebase_config) 
  : firebaseConfig;

const app = initializeApp(validConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-class-app';

// --- Types ---
type EventType = 'exam' | 'homework' | 'activity' | 'other';
type UserRole = 'teacher' | 'student' | 'general_affairs'; // Added missing type definition

// Permission Types
type PermissionType = 'manage_calendar' | 'manage_tasks' | 'manage_notices' | 'manage_photos' | 'manage_whiteboard';

interface UserProfile {
  docId?: string;
  uid: string;
  displayName: string;
  photoURL?: string | null;
  email?: string;
  joinedClassId?: string | null;
  
  // New Role & Permission System
  isTeacher?: boolean;        // Is this user a main teacher (admin)?
  customRoleTitle?: string;   // Custom title e.g. "總務", "活動長"
  permissions?: PermissionType[]; // List of granular permissions
  role?: UserRole; // Added to match usage in code
}

interface Classroom {
  id: string;
  name: string;
  inviteCode: string;
  teacherIds: string[]; // Support multiple teachers
  createdAt: any;
}

interface ClassEvent {
  id: string;
  classId: string;
  title: string;
  date: string;
  type: EventType;
  createdAt: any;
  createdBy: string;
}

interface Notice {
  id: string;
  classId: string;
  title: string;
  content: string;
  isImportant: boolean;
  createdAt: any;
  createdBy: string;
  createdByName?: string;
}

interface ClassTask {
  id: string;
  classId: string;
  title: string;
  assignedToUid: string;
  assignedToName: string;
  dueDate: string;
  isCompleted: boolean;
  week: string;
  colorStyle?: string; // New: Custom background color
  createdAt: any;
  createdBy: string;
}

interface WhiteboardPath {
  id: string;
  classId: string;
  points: {x: number, y: number}[];
  color: string;
  width: number;
  isEraser?: boolean;
  createdAt: any;
}

interface ClassPhoto {
  id: string;
  classId: string;
  imageUrl: string;
  date: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: any;
}

// --- Constants ---
const TASK_COLORS = [
  { value: 'bg-red-100 text-red-800 border-red-200', bg: 'bg-red-100', border: 'border-red-200' },
  { value: 'bg-orange-100 text-orange-800 border-orange-200', bg: 'bg-orange-100', border: 'border-orange-200' },
  { value: 'bg-amber-100 text-amber-800 border-amber-200', bg: 'bg-amber-100', border: 'border-amber-200' },
  { value: 'bg-emerald-100 text-emerald-800 border-emerald-200', bg: 'bg-emerald-100', border: 'border-emerald-200' },
  { value: 'bg-cyan-100 text-cyan-800 border-cyan-200', bg: 'bg-cyan-100', border: 'border-cyan-200' },
  { value: 'bg-violet-100 text-violet-800 border-violet-200', bg: 'bg-violet-100', border: 'border-violet-200' },
];

const PERMISSION_LABELS: Record<PermissionType, string> = {
  'manage_calendar': '管理行事曆',
  'manage_tasks': '指派任務',
  'manage_notices': '發布公告',
  'manage_photos': '管理相簿',
  'manage_whiteboard': '清理白板'
};

// --- Holidays Data (Taiwan) ---
const HOLIDAYS: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人節',
  '02-28': '和平紀念日',
  '04-04': '兒童節',
  '05-01': '勞動節',
  '08-08': '父親節',
  '09-28': '教師節',
  '10-10': '國慶日',
  '10-31': '萬聖節',
  '12-25': '聖誕節',
  '2025-01-25': '調整放假',
  '2025-01-27': '彈性放假',
  '2025-01-28': '除夕',
  '2025-01-29': '春節',
  '2025-01-30': '初二',
  '2025-01-31': '初三',
  '2025-02-01': '初四',
  '2025-04-05': '清明節',
  '2025-05-31': '端午節',
  '2025-10-06': '中秋節',
  '2026-02-16': '除夕',
  '2026-02-17': '春節',
  '2026-04-05': '清明節',
  '2026-06-19': '端午節',
  '2026-09-25': '中秋節',
};

// --- Helper: Generate Invite Code ---
const generateInviteCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// --- Helper: Get Role Label (Added missing helper) ---
const getRoleLabel = (role?: string) => {
    switch (role) {
        case 'teacher': return '老師';
        case 'student': return '同學';
        case 'general_affairs': return '總務';
        default: return '成員';
    }
};

// --- Helper: Image Compression (Optimized for Quality) ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; 
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- Helper: Format Time ---
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- Helper: Get Holiday ---
const getHoliday = (dateStr: string) => {
  const [, month, day] = dateStr.split('-');
  const fixedKey = `${month}-${day}`;
  if (HOLIDAYS[dateStr]) return HOLIDAYS[dateStr];
  if (HOLIDAYS[fixedKey]) return HOLIDAYS[fixedKey];
  return null;
};

// --- Modal Component to replace native alert/confirm ---
const Modal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "確定", cancelText = "取消", isAlert = false }: any) => {
    if (!isOpen) return null;
    return (
        <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
                <p className="text-slate-600 mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    {!isAlert && (
                        <button onClick={onCancel} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">
                            {cancelText}
                        </button>
                    )}
                    <button onClick={onConfirm} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Component ---

export default function ClassManagerApp() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  
  // App View State
  const [view, setView] = useState<'loading' | 'login' | 'setup_profile' | 'lobby' | 'app'>('loading');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // Main App State
  const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'notices' | 'whiteboard' | 'photos' | 'pomodoro'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Data State
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tasks, setTasks] = useState<ClassTask[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [whiteboardPaths, setWhiteboardPaths] = useState<WhiteboardPath[]>([]);
  const [photos, setPhotos] = useState<ClassPhoto[]>([]);

  // Whiteboard State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  // Pomodoro State
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoIsActive, setPomoIsActive] = useState(false);
  const [pomoMode, setPomoMode] = useState<'focus' | 'break'>('focus');

  // Setup Forms State
  const [setupName, setSetupName] = useState('');
  const [createClassName, setCreateClassName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [isPhotoUploadOpen, setIsPhotoUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ClassPhoto | null>(null);
  const [isRoleEditOpen, setIsRoleEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);

  // Modal State for Confirmations
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isAlert?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isAlert: false });

  // Role Editing State
  const [editRoleTitle, setEditRoleTitle] = useState('');
  const [editPermissions, setEditPermissions] = useState<PermissionType[]>([]);
  const [editIsTeacher, setEditIsTeacher] = useState(false);

  // Forms inside App
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<EventType>('homework');
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [isNoticeImportant, setIsNoticeImportant] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskWeek, setNewTaskWeek] = useState('第1週');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskColor, setNewTaskColor] = useState(TASK_COLORS[1].value);
  
  // Photo Upload State
  const [photoDate, setPhotoDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Colors Palette for Whiteboard
  const wbColors = ['#000000', '#525252', '#9CA3AF', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#78350F'];

  // Helper for Modals
  const showAlert = (title: string, message: string) => {
      setModalConfig({
          isOpen: true,
          title,
          message,
          onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
          isAlert: true
      });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
      setModalConfig({
          isOpen: true,
          title,
          message,
          onConfirm: () => {
              onConfirm();
              setModalConfig(prev => ({ ...prev, isOpen: false }));
          },
          isAlert: false
      });
  };

  // --- Auth & Initial Loading ---

  useEffect(() => {
    // Gemini Auth Handler
    const initAuth = async () => {
        if (typeof (window as any).__initial_auth_token !== 'undefined' && (window as any).__initial_auth_token) {
            try {
                await signInWithCustomToken(auth, (window as any).__initial_auth_token);
            } catch (e) {
                console.error("Custom token auth failed", e);
                await signInAnonymously(auth);
            }
        } else {
            // Wait a bit for auth state to stabilize or fallback
        }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await checkUserProfile(u);
      } else {
        setView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  const checkUserProfile = async (currentUser: any) => {
    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'user_profiles'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const profile = { ...docSnap.data(), docId: docSnap.id } as UserProfile;
        setUserProfile(profile);
        if (profile.joinedClassId) {
          const classRef = doc(db, 'artifacts', appId, 'public', 'data', 'classrooms', profile.joinedClassId);
          const classSnap = await getDoc(classRef);
          if (classSnap.exists()) {
            setClassroom({ id: classSnap.id, ...classSnap.data() } as Classroom);
            setView('app');
          } else {
            setView('lobby'); 
          }
        } else {
          setView('lobby');
        }
      } else {
        if (currentUser.displayName) {
          setSetupName(currentUser.displayName);
        }
        setView('setup_profile');
      }
    } catch (e: any) {
      console.warn("Profile check note:", e.message); 
      setView('setup_profile');
    } finally {
        setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google Login Error:", error);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment' || error.message.includes('iframe')) {
        showAlert("⚠️ 預覽環境限制", "Google 登入在此預覽視窗中受限。\n將自動切換為「模擬登入模式」以便您測試功能。\n(正式部署後 Google 登入即可正常運作)");
        await signInAnonymously(auth);
      } else {
        showAlert("錯誤", "登入失敗，請重試");
        setIsGoogleLoading(false);
      }
    }
  };

  const handleGuestLogin = async () => {
    setIsGoogleLoading(true);
    try {
        await signInAnonymously(auth);
    } catch (e) {
        console.error("Guest login failed", e);
        setIsGoogleLoading(false);
    }
  };

  // --- Main App Data Sync ---
  useEffect(() => {
    if (!user || !userProfile?.joinedClassId || view !== 'app') return;
    const classId = userProfile.joinedClassId;

    const eventsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'class_events'), where('classId', '==', classId));
    const unsubEvents = onSnapshot(eventsQuery, (snap) => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassEvent)).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())), (e) => console.error("Events sync error:", e));

    const noticesQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'class_notices'), where('classId', '==', classId));
    const unsubNotices = onSnapshot(noticesQuery, (snap) => setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), (e) => console.error("Notices sync error:", e));

    const tasksQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'class_tasks'), where('classId', '==', classId));
    const unsubTasks = onSnapshot(tasksQuery, (snap) => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassTask)).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), (e) => console.error("Tasks sync error:", e));

    const wbQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'class_whiteboard_paths'), where('classId', '==', classId));
    const unsubWb = onSnapshot(wbQuery, (snap) => {
      // Filter out malformed paths to prevent crash
      let loadedPaths = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as WhiteboardPath))
        .filter(p => Array.isArray(p.points) && p.points.length > 0); // CRITICAL FIX
        
      loadedPaths.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setWhiteboardPaths(loadedPaths.slice(0, 100).reverse());
    }, (e) => console.error("Whiteboard sync error:", e));

    const usersQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'user_profiles'), where('joinedClassId', '==', classId));
    const unsubUsers = onSnapshot(usersQuery, (snap) => setAllUsers(snap.docs.map(d => ({ ...d.data(), docId: d.id } as UserProfile))), (e) => console.error("Users sync error:", e));

    const photosQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'class_photos'), where('classId', '==', classId));
    const unsubPhotos = onSnapshot(photosQuery, (snap) => setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassPhoto)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())), (e) => console.error("Photos sync error:", e));

    const classRef = doc(db, 'artifacts', appId, 'public', 'data', 'classrooms', classId);
    const unsubClass = onSnapshot(classRef, (snap) => {
      if (snap.exists()) {
        setClassroom({ id: snap.id, ...snap.data() } as Classroom);
      }
    });

    return () => { unsubEvents(); unsubNotices(); unsubTasks(); unsubWb(); unsubUsers(); unsubPhotos(); unsubClass(); };
  }, [user, userProfile?.joinedClassId, view]);

  // --- Pomodoro Logic ---
  useEffect(() => {
    let interval: any;
    if (pomoIsActive && pomoTime > 0) {
      interval = setInterval(() => setPomoTime((prev) => prev - 1), 1000);
    } else if (pomoTime === 0 && pomoIsActive) {
      setPomoIsActive(false);
      showAlert("時間到", pomoMode === 'focus' ? "專注時間結束！休息一下吧 ☕" : "休息結束！回到工作崗位 💪");
      if(pomoMode === 'focus') { setPomoMode('break'); setPomoTime(5 * 60); }
      else { setPomoMode('focus'); setPomoTime(25 * 60); }
    }
    return () => clearInterval(interval);
  }, [pomoIsActive, pomoTime, pomoMode]);

  const toggleTimer = () => setPomoIsActive(!pomoIsActive);
  const resetTimer = () => {
    setPomoIsActive(false);
    setPomoTime(pomoMode === 'focus' ? 25 * 60 : 5 * 60);
  };
  const switchPomoMode = (mode: 'focus' | 'break') => {
    setPomoMode(mode);
    setPomoIsActive(false);
    setPomoTime(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  // --- Logic: Permissions & Roles ---
  const daysSinceCreation = useMemo(() => {
    if (!classroom?.createdAt) return 0;
    const startTime = classroom.createdAt.seconds ? classroom.createdAt.seconds * 1000 : Date.now();
    const days = Math.floor((Date.now() - startTime) / (1000 * 60 * 60 * 24));
    return days < 0 ? 0 : days;
  }, [classroom]);

  const photosByDate = useMemo(() => {
    const grouped: { [key: string]: ClassPhoto[] } = {};
    photos.forEach(photo => { if (!grouped[photo.date]) grouped[photo.date] = []; grouped[photo.date].push(photo); });
    return grouped;
  }, [photos]);

  const selectedDateEvents = useMemo(() => events.filter(e => e.date === selectedDate), [events, selectedDate]);
  const selectedDateTasks = useMemo(() => tasks.filter(t => t.dueDate === selectedDate), [tasks, selectedDate]);
  const myTasks = useMemo(() => tasks.filter(t => t.assignedToUid === user?.uid), [tasks, user]);
  const tasksByWeek = useMemo(() => { const g: {[k:string]:ClassTask[]} = {}; tasks.forEach(t => { if(!g[t.week]) g[t.week]=[]; g[t.week].push(t); }); return g; }, [tasks]);

  // --- Permission Helpers ---
  const isTeacher = (uid: string) => classroom?.teacherIds?.includes(uid) || false;
  const isMeTeacher = useMemo(() => user && classroom ? isTeacher(user.uid) : false, [user, classroom]);
  
  const hasPermission = (permission: PermissionType) => {
    if (isMeTeacher) return true; 
    return userProfile?.permissions?.includes(permission) || false;
  };

  // --- Handlers ---
  const handleCreateProfile = async () => {
    if (!setupName.trim() || !user) return;
    try {
      const newProfile = { 
        uid: user.uid, 
        displayName: setupName, 
        role: 'student' as UserRole, 
        email: user.email || `${user.uid.slice(0,5)}@school.edu`,
        photoURL: user.photoURL || null,
        joinedClassId: null,
        isTeacher: false,
        permissions: []
      };
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'user_profiles'), newProfile);
      setUserProfile({ ...newProfile, docId: docRef.id });
      setView('lobby');
    } catch (e) {
      console.error("Failed to create profile", e);
      showAlert("錯誤", "建立個人檔案失敗，請檢查網路連線");
    }
  };

  const handleCreateClass = async () => {
    if (!createClassName.trim() || !user || !userProfile?.docId) return;
    const inviteCode = generateInviteCode();
    const classRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'classrooms'), { 
      name: createClassName, 
      teacherIds: [user.uid], 
      inviteCode: inviteCode, 
      createdAt: serverTimestamp() 
    });
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_profiles', userProfile.docId), { 
      role: 'teacher', 
      isTeacher: true,
      joinedClassId: classRef.id 
    });
    
    setUserProfile(prev => prev ? ({ ...prev, role: 'teacher', isTeacher: true, joinedClassId: classRef.id }) : null);
    setClassroom({ id: classRef.id, name: createClassName, teacherIds: [user.uid], inviteCode, createdAt: null });
    setView('app');
  };

  const handleJoinClass = async () => {
    if (!joinInviteCode.trim() || !user || !userProfile?.docId) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'classrooms'), where('inviteCode', '==', joinInviteCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) { setJoinError('找不到此邀請碼的班級，請確認後再試。'); return; }
    const classDoc = snapshot.docs[0];
    const classData = classDoc.data() as Classroom;
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_profiles', userProfile.docId), { 
      role: 'student', 
      isTeacher: false,
      permissions: [],
      customRoleTitle: null,
      joinedClassId: classDoc.id 
    });
    
    setUserProfile(prev => prev ? ({ ...prev, role: 'student', isTeacher: false, permissions: [], customRoleTitle: undefined, joinedClassId: classDoc.id }) : null);
    setClassroom({ id: classDoc.id, ...classData });
    setView('app');
  };

  const handleLogoutClass = () => {
    if (!user || !userProfile?.docId) return;
    showConfirm("登出班級", "確定要登出此班級嗎？", async () => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_profiles', userProfile.docId!), { joinedClassId: null });
        setUserProfile(prev => prev ? ({...prev, joinedClassId: undefined}) : null);
        setClassroom(null);
        setView('lobby');
    });
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setView('login');
  };

  const copyInviteCode = () => {
    if (classroom?.inviteCode) {
      // Use document.execCommand for iframe compatibility if needed, but clipboard API is standard now
      try {
          navigator.clipboard.writeText(classroom.inviteCode);
          showAlert("成功", "邀請碼已複製！");
      } catch (e) {
          const textArea = document.createElement("textarea");
          textArea.value = classroom.inviteCode;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          showAlert("成功", "邀請碼已複製！");
      }
    }
  };

  // --- Role & Permission Management Handlers ---
  const openRoleEditor = (member: UserProfile) => {
    setEditingMember(member);
    setEditRoleTitle(member.customRoleTitle || (member.isTeacher ? '導師' : '同學'));
    setEditPermissions(member.permissions || []);
    setEditIsTeacher(isTeacher(member.uid)); 
    setIsRoleEditOpen(true);
  };

  const togglePermission = (perm: PermissionType) => {
    setEditPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const saveRoleSettings = async () => {
    if (!editingMember?.docId || !classroom) return;

    const batch = writeBatch(db);
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_profiles', editingMember.docId);
    const classRef = doc(db, 'artifacts', appId, 'public', 'data', 'classrooms', classroom.id);

    batch.update(userRef, {
      customRoleTitle: editRoleTitle,
      permissions: editPermissions,
      isTeacher: editIsTeacher, 
      role: editIsTeacher ? 'teacher' : (editPermissions.length > 0 ? 'general_affairs' : 'student')
    });

    if (editIsTeacher) {
      batch.update(classRef, { teacherIds: arrayUnion(editingMember.uid) });
    } else {
      batch.update(classRef, { teacherIds: arrayRemove(editingMember.uid) });
    }

    try {
      await batch.commit();
      setIsRoleEditOpen(false);
      setEditingMember(null);
    } catch (e) {
      console.error("Error updating role:", e);
      showAlert("錯誤", "更新失敗，請重試");
    }
  };

  // --- Feature Handlers ---
  const handleAddEvent = async () => {
    if (!newEventTitle || !userProfile?.joinedClassId) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'class_events'), { classId: userProfile.joinedClassId, title: newEventTitle, date: selectedDate, type: newEventType, createdBy: user.uid, createdAt: serverTimestamp() });
    setNewEventTitle(''); setIsEventModalOpen(false);
  };
  const handleAddNotice = async () => {
    if (!newNoticeTitle || !userProfile?.joinedClassId) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'class_notices'), { classId: userProfile.joinedClassId, title: newNoticeTitle, content: newNoticeContent, isImportant: isNoticeImportant, createdBy: user.uid, createdByName: userProfile.displayName, createdAt: serverTimestamp() });
    setNewNoticeTitle(''); setNewNoticeContent(''); setIsNoticeImportant(false); setIsNoticeModalOpen(false);
  };
  const handleAddTask = async () => {
    if (!newTaskTitle || !newTaskAssignee || !userProfile?.joinedClassId) return;
    const assignee = allUsers.find(u => u.uid === newTaskAssignee);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'class_tasks'), { 
      classId: userProfile.joinedClassId, 
      title: newTaskTitle, 
      week: newTaskWeek, 
      assignedToUid: newTaskAssignee, 
      assignedToName: assignee?.displayName || '未知', 
      dueDate: newTaskDueDate, 
      isCompleted: false, 
      colorStyle: newTaskColor, 
      createdBy: user.uid, 
      createdAt: serverTimestamp() 
    });
    setNewTaskTitle(''); setNewTaskDueDate(''); setIsTaskModalOpen(false);
  };
  
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !userProfile?.joinedClassId) return;
    setIsUploadingPhoto(true);
    const file = e.target.files[0];
    try {
      const compressedBase64 = await compressImage(file);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'class_photos'), { 
        classId: userProfile.joinedClassId, 
        imageUrl: compressedBase64, 
        date: photoDate, 
        uploadedBy: user.uid, 
        uploadedByName: userProfile.displayName, 
        createdAt: serverTimestamp() 
      });
      setIsPhotoUploadOpen(false);
    } catch (error) { 
      console.error(error);
      showAlert("錯誤", "圖片上傳失敗，請確認圖片大小或網路連線"); 
    } finally { 
      setIsUploadingPhoto(false); 
    }
  };
  const handleDeletePhoto = async (photoId: string) => { 
      showConfirm("刪除照片", "確定要刪除這張照片嗎？", async () => { 
          await handleDeleteItem('class_photos', photoId); 
          setSelectedPhoto(null); 
      }); 
  };
  const toggleTask = async (task: ClassTask) => { 
    const canToggle = user.uid === task.assignedToUid || isMeTeacher || hasPermission('manage_tasks');
    if (!canToggle) return; 
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'class_tasks', task.id), { isCompleted: !task.isCompleted }); 
  };
  const handleDeleteItem = async (col: string, id: string) => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id));
  
  const handleLeaveClass = () => {
    if (!user || !userProfile?.docId) return;
    showConfirm("退出班級", "確定要退出這個班級嗎？(資料將不再同步，若要回來需重新輸入邀請碼)", async () => {
        if (classroom && isTeacher(user.uid)) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'classrooms', classroom.id), { 
                teacherIds: arrayRemove(user.uid) 
            });
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_profiles', userProfile.docId!), { 
            joinedClassId: null, permissions: [], isTeacher: false, customRoleTitle: null
        });
        setUserProfile(prev => prev ? ({...prev, joinedClassId: undefined}) : null);
        setClassroom(null);
        setView('lobby');
        setIsSettingsOpen(false);
    });
  };

  // Whiteboard Logic with Safety Check & Performance Fix
  useEffect(() => {
    if (activeTab === 'whiteboard' && canvasRef.current && view === 'app') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const parent = canvas.parentElement;
        
        // FIX: Only resize if dimensions actually changed to prevent context clearing/loops
        if (parent) { 
            const rect = parent.getBoundingClientRect();
            // Checking clientWidth vs canvas.width to prevent infinite resize loop
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = rect.width; 
                canvas.height = rect.height; 
            }
        }
        
        ctx.lineCap = 'round'; 
        ctx.lineJoin = 'round';
        // Only clear if we didn't just resize (resize clears automatically), but explicitly clearing is safer for redraws
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        whiteboardPaths.forEach(path => {
          // CRITICAL: Skip drawing if points are missing or empty
          if (!path.points || !Array.isArray(path.points) || path.points.length < 2) return;
          
          ctx.beginPath();
          if (path.isEraser) { ctx.globalCompositeOperation = 'destination-out'; } 
          else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = path.color; }
          
          ctx.lineWidth = path.width;
          
          // Safety check for first point
          const start = path.points[0];
          if (!start || typeof start.x !== 'number' || typeof start.y !== 'number') return;

          ctx.moveTo(start.x, start.y);
          
          for (let i = 1; i < path.points.length; i++) {
              const p = path.points[i];
              // Safety check for every point
              if (p && typeof p.x === 'number' && typeof p.y === 'number') {
                  ctx.lineTo(p.x, p.y);
              }
          }
          ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over';
      } catch (err) {
        console.error("Canvas redraw error:", err);
      }
    }
  }, [whiteboardPaths, activeTab, view]);

  // Touch event handling for drawing
  const getCanvasCoords = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    
    // Robust touch coordinate extraction
    if (e.nativeEvent instanceof TouchEvent || (e.touches && e.touches.length > 0)) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.nativeEvent instanceof MouseEvent || e.clientX !== undefined) {
        clientX = e.clientX;
        clientY = e.clientY;
    } else {
        // Fallback for odd cases or touch end
        return { x: 0, y: 0 };
    }
    
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => { 
    setIsDrawing(true); 
    setCurrentPath([getCanvasCoords(e)]); 
  };

  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current || currentPath.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    if (coords.x === 0 && coords.y === 0) return; // Skip if invalid

    const newPath = [...currentPath, coords];
    setCurrentPath(newPath);
    
    const last = currentPath[currentPath.length - 1];
    if (!last) return;

    ctx.beginPath();
    if (isEraser) { ctx.globalCompositeOperation = 'destination-out'; } 
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = brushColor; }
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.moveTo(last.x, last.y); 
    ctx.lineTo(coords.x, coords.y); 
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const endDrawing = async () => {
    setIsDrawing(false);
    if (currentPath.length > 1 && userProfile?.joinedClassId) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'class_whiteboard_paths'), { 
          classId: userProfile.joinedClassId, 
          points: currentPath, 
          color: isEraser ? '#ffffff' : brushColor, 
          isEraser, 
          width: brushSize, 
          createdAt: serverTimestamp() 
        });
      } catch (e) {
        console.error("Error saving path:", e);
      }
    }
    setCurrentPath([]);
  };
  
  const clearWhiteboard = async () => {
    if (!userProfile?.joinedClassId) return;
    showConfirm("清除白板", "清除所有塗鴉？", async () => {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'class_whiteboard_paths'), where('classId', '==', userProfile.joinedClassId));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    });
  };

  // --- RENDER ---

  if (view === 'loading') return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400">系統載入中...</div>;

  // VIEW: LOGIN
  if (view === 'login') return (
    <div className="h-screen flex flex-col bg-indigo-600 text-white p-6 justify-center items-center">
      <div className="bg-white text-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center">
        <School size={64} className="mx-auto mb-4 text-indigo-500" />
        <h1 className="text-2xl font-bold mb-2">歡迎使用<br/>班級小管家</h1>
        <p className="text-slate-400 text-sm mb-8">跨平台 • 雲端同步 • 班級協作</p>
        <button onClick={handleGoogleLogin} disabled={isGoogleLoading} className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold shadow-md hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 mb-4">{isGoogleLoading ? <RefreshCw className="animate-spin" /> : "Google 登入"}</button>
        <button onClick={handleGuestLogin} className="text-xs text-slate-400 hover:text-slate-600 underline">訪客試用 (免登入)</button>
      </div>
      <p className="mt-8 text-indigo-200 text-xs"><Smartphone size={12} className="inline mr-1"/>手機平板電腦皆可使用</p>
      {/* Alert/Confirm Modal Placeholder for login screen errors */}
      <Modal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        onConfirm={modalConfig.onConfirm} 
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        isAlert={modalConfig.isAlert}
      />
    </div>
  );

  // VIEW: SETUP PROFILE
  if (view === 'setup_profile') return (
    <div className="h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white w-full max-w-sm rounded-2xl p-8 shadow-xl text-center">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4"><User size={32} /></div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">設定個人檔案</h2>
        <p className="text-sm text-slate-500 mb-6">請輸入您在班級中的真實姓名</p>
        <input type="text" value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="例如: 王小明" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 outline-indigo-500" />
        <button onClick={handleCreateProfile} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200">下一步</button>
      </div>
      <Modal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        onConfirm={modalConfig.onConfirm} 
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        isAlert={modalConfig.isAlert}
      />
    </div>
  );

  // VIEW: LOBBY
  if (view === 'lobby') return (
    <div className="h-screen flex flex-col bg-indigo-600 text-white p-6">
      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8">
        <div><School size={64} className="mx-auto mb-4 text-indigo-200" /><h1 className="text-3xl font-bold mb-2">班級大廳</h1><p className="text-indigo-200">建立或加入一個班級</p></div>
        <div className="w-full max-w-sm space-y-4">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20"><h3 className="font-bold text-lg mb-4">我是老師</h3><input type="text" value={createClassName} onChange={e => setCreateClassName(e.target.value)} placeholder="輸入新班級名稱" className="w-full bg-black/20 border border-white/30 rounded-lg p-3 text-white placeholder-indigo-200 mb-3 outline-none focus:bg-black/30" /><button onClick={handleCreateClass} className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors">建立新班級</button></div>
          <div className="flex items-center gap-4 opacity-50"><div className="h-px bg-white flex-1"></div><span>或</span><div className="h-px bg-white flex-1"></div></div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20"><h3 className="font-bold text-lg mb-4">我是同學</h3><input type="text" value={joinInviteCode} onChange={e => setJoinInviteCode(e.target.value)} placeholder="輸入6位數邀請碼" className="w-full bg-black/20 border border-white/30 rounded-lg p-3 text-white placeholder-indigo-200 mb-3 outline-none focus:bg-black/30 tracking-widest text-center font-mono text-lg" maxLength={6} /><button onClick={handleJoinClass} className="w-full bg-indigo-500 border border-indigo-400 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-400 transition-colors">加入班級</button>{joinError && <p className="text-red-300 text-xs mt-2">{joinError}</p>}</div>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-indigo-300 w-full max-w-sm mx-auto">
        <span>登入身分: {userProfile?.displayName}</span>
        <button onClick={handleSignOut} className="underline hover:text-white">登出</button>
      </div>
      <Modal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        onConfirm={modalConfig.onConfirm} 
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        isAlert={modalConfig.isAlert}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans text-slate-800">
      <header className="bg-indigo-600 text-white p-4 shadow-md z-10">
        <div className="flex justify-between items-center mb-1">
           <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
             {classroom?.name}
           </h1>
           <div className="flex items-center gap-3">
            {isMeTeacher && <button onClick={() => setIsManageMembersOpen(true)} className="bg-indigo-500 p-2 rounded-full"><Users size={16} /></button>}
            <button onClick={() => setIsSettingsOpen(true)} className="bg-indigo-500 p-2 rounded-full hover:bg-indigo-400"><Settings size={16} /></button>
            <button onClick={handleSignOut} className="bg-indigo-700 p-2 rounded-full hover:bg-indigo-800 text-indigo-200"><LogOut size={16} /></button>
           </div>
        </div>
        <div className="flex justify-between items-end">
          <p className="text-xs text-indigo-200 flex items-center gap-1">
            <User size={12} /> 
            {userProfile?.displayName} 
            <span className="ml-1 opacity-70">
              {isTeacher(user.uid) ? '• 導師' : (userProfile?.customRoleTitle ? `• ${userProfile.customRoleTitle}` : '')}
            </span>
          </p>
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1 bg-indigo-700/50 px-2 py-1 rounded text-[10px] text-indigo-100"><CalendarDays size={12} /><span>{daysSinceCreation} 天</span></div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 relative bg-white">
        {activeTab === 'calendar' && (
          <div className="p-4 space-y-4 bg-slate-50 min-h-full">
            <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button><h2 className="text-lg font-bold text-slate-700">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button></div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
              <div className="grid grid-cols-7 mb-2 text-center text-xs font-medium text-slate-400"><div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div></div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`e${i}`} className="min-h-[80px]"></div>)}
                {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => { 
                  const d = i + 1; 
                  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; 
                  const isSel = selectedDate === dateStr; 
                  const dayEvts = events.filter(e => e.date === dateStr); 
                  const dayTasks = tasks.filter(t => t.dueDate === dateStr); 
                  const holidayName = getHoliday(dateStr);

                  return (
                    <button key={d} onClick={() => setSelectedDate(dateStr)} className={`min-h-[80px] rounded-lg flex flex-col items-start justify-start p-1 relative border transition-all ${isSel ? 'bg-indigo-50 border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                      <div className="w-full flex justify-between items-start">
                        <span className={`text-xs pl-1 ${isSel ? 'font-bold text-indigo-700' : holidayName ? 'text-red-500 font-bold' : 'text-slate-600'}`}>{d}</span>
                        {holidayName && <span className="text-[9px] text-red-500 font-bold pr-1 truncate max-w-[3rem]">{holidayName}</span>}
                      </div>
                      <div className="flex flex-wrap gap-0.5 w-full mt-1">
                        {dayEvts.map(evt => <div key={evt.id} className={`w-1.5 h-1.5 rounded-full ${evt.type==='exam'?'bg-red-500':'bg-blue-400'}`}></div>)}
                      </div>
                      <div className="w-full mt-1 space-y-0.5">
                        {dayTasks.slice(0, 2).map(t => (
                          <div key={t.id} className={`text-[8px] px-1 py-0.5 rounded truncate w-full text-left ${t.colorStyle || 'bg-orange-100 text-orange-800'}`}>
                            {t.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && <div className="text-[8px] text-slate-400 pl-1">+{dayTasks.length - 2} 更多</div>}
                      </div>
                    </button>
                  ); 
                })}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-slate-600 flex items-center gap-2">
                  <Clock size={16}/> {selectedDate} 
                  {getHoliday(selectedDate) && <span className="text-red-500 text-sm ml-2">({getHoliday(selectedDate)})</span>}
                </h3>
              </div>
              {selectedDateEvents.length===0 && selectedDateTasks.length===0 ? <div className="text-center py-6 text-slate-400 border-2 border-dashed rounded-xl">無安排</div> : 
                <>
                  {selectedDateEvents.map(e => (<div key={e.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"><div className="flex gap-3 items-center"><div className={`p-2 rounded border ${e.type==='exam' ? 'bg-red-100 text-red-700' : e.type==='homework' ? 'bg-blue-100 text-blue-700' : e.type==='activity' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{e.type==='exam'?<PenTool size={18}/>:<BookOpen size={18}/>}</div><div><div className="font-bold">{e.title}</div><div className="text-xs text-slate-400">{e.type}</div></div></div>{(hasPermission('manage_calendar')) && <button onClick={() => handleDeleteItem('class_events', e.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>}</div>))}
                  {selectedDateTasks.map(t => (
                    <div key={t.id} onClick={() => toggleTask(t)} className={`bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center cursor-pointer transition-colors ${t.isCompleted ? 'opacity-60 bg-slate-50' : 'hover:bg-orange-50 border-orange-100'}`}>
                        <div className="flex gap-3 items-center">
                          <div className={`p-2 rounded border ${t.isCompleted ? 'bg-slate-200 text-slate-500' : t.colorStyle ? t.colorStyle.replace('text-', 'border-').replace('bg-', 'text-') : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                            {t.isCompleted ? <CheckCircle size={18}/> : <CheckSquare size={18}/>}
                          </div>
                          <div>
                            <div className={`font-bold ${t.isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{t.title}</div>
                            <div className="text-xs text-slate-400">任務截止 • {t.assignedToName}</div>
                          </div>
                        </div>
                        {/* Allow deletion from calendar if permission */}
                        {hasPermission('manage_tasks') && <button onClick={(e) => { e.stopPropagation(); handleDeleteItem('class_tasks', t.id); }} className="text-slate-200 hover:text-red-400"><Trash2 size={14}/></button>}
                    </div>
                  ))}
                </>
              }
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="p-4 space-y-6 bg-slate-50 min-h-full">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-700 px-1 flex items-center gap-2"><CheckSquare className="text-indigo-500"/> 每週任務</h2>
              {(isMeTeacher || hasPermission('manage_tasks')) && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">管理員模式</span>}
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl"><h3 className="text-indigo-900 font-bold text-sm mb-3">我的待辦</h3>{myTasks.length===0 ? <p className="text-xs text-indigo-400">目前沒有任務</p> : myTasks.map(t => (<div key={t.id} onClick={() => toggleTask(t)} className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3 mb-2 cursor-pointer">{t.isCompleted ? <CheckCircle className="text-green-500" size={20}/> : <Circle className="text-slate-300" size={20}/>}<div className="flex-1"><div className={`font-bold text-sm ${t.isCompleted?'text-slate-400 line-through':''}`}>{t.title}</div><div className="text-xs text-slate-500">{t.dueDate}</div></div></div>))}</div>
            <div className="space-y-4"><h3 className="text-slate-500 text-xs font-bold uppercase px-1">全班進度</h3>{Object.entries(tasksByWeek).reverse().map(([week, weekTasks]) => (<div key={week} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="bg-slate-50 px-4 py-2 border-b text-sm font-bold text-slate-700 flex justify-between"><span>{week}</span><span className="text-xs font-normal text-slate-400">{weekTasks.filter(t=>t.isCompleted).length}/{weekTasks.length} 完成</span></div>{weekTasks.map(t => (<div key={t.id} className="p-3 flex justify-between items-center border-b last:border-0 border-slate-50"><div className="flex items-center gap-3"><div onClick={() => toggleTask(t)} className={hasPermission('manage_tasks') || user.uid===t.assignedToUid ? 'cursor-pointer' : 'cursor-default'}>{t.isCompleted ? <CheckCircle className="text-green-500" size={16}/> : <Circle className="text-slate-300" size={16}/>}</div><div><div className={`text-sm ${t.isCompleted?'text-slate-400':''}`}>{t.title}</div><div className="text-[10px] text-slate-400 flex items-center gap-1"><User size={10}/> {t.assignedToName}</div></div></div>{hasPermission('manage_tasks') && <button onClick={() => handleDeleteItem('class_tasks', t.id)} className="text-slate-200 hover:text-red-400"><Trash2 size={14}/></button>}</div>))}</div>))}</div>
          </div>
        )}

        {activeTab === 'notices' && (
          <div className="p-4 space-y-4 bg-slate-50 min-h-full">
            <h2 className="text-lg font-bold text-slate-700 px-1">佈告欄</h2>
            {notices.length===0 && <div className="text-center py-10 text-slate-400">無公告</div>}
            {notices.map(n => (<div key={n.id} className={`bg-white rounded-xl shadow-sm border relative ${n.isImportant?'border-l-4 border-l-red-500':'border-slate-100'}`}>{n.isImportant && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg">重要</div>}<div className="p-4"><div className="flex justify-between items-start mb-2"><h3 className={`font-bold ${n.isImportant?'text-red-600':''}`}>{n.title}</h3>{hasPermission('manage_notices') && <button onClick={()=>handleDeleteItem('class_notices',n.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={14}/></button>}</div><p className="text-sm text-slate-600 whitespace-pre-wrap">{n.content}</p><div className="mt-3 pt-3 border-t border-slate-50 text-[10px] text-slate-400 flex justify-between"><span>{n.createdByName}</span><span>{new Date(n.createdAt?.seconds*1000).toLocaleDateString()}</span></div></div></div>))}
          </div>
        )}

        {activeTab === 'whiteboard' && (
          <div className="h-full flex flex-col relative bg-slate-100">
            <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur rounded-2xl shadow-md p-3 flex flex-col gap-3 z-20">
              <div className="flex items-center justify-between"><div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full pr-2">{wbColors.map(c => <button key={c} onClick={()=>{setBrushColor(c); setIsEraser(false)}} className={`w-8 h-8 rounded-full border-2 flex-shrink-0 ${brushColor===c && !isEraser ? 'scale-110 border-indigo-500 shadow-sm' : 'border-slate-100'}`} style={{backgroundColor:c}} />)}</div><div className="flex items-center gap-2 pl-2 border-l border-slate-200"><button onClick={()=>setIsEraser(true)} className={`p-2 rounded-lg ${isEraser?'bg-indigo-100 text-indigo-600':'text-slate-400'}`}><Eraser size={20}/></button>{(isMeTeacher || userProfile?.role === 'general_affairs') && <button onClick={clearWhiteboard} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><RefreshCw size={20}/></button>}</div></div>
              <div className="flex items-center gap-3 px-1"><span className="text-[10px] font-bold text-slate-400 uppercase">{isEraser?'擦布':'筆刷'}</span><input type="range" min="1" max="20" value={brushSize} onChange={e=>setBrushSize(parseInt(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" /><div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center" style={{transform:`scale(${brushSize/10+0.5})`, backgroundColor:isEraser?'#94a3b8':brushColor}}></div></div>
            </div>
            <div style={{ touchAction: 'none' }} className="flex-1 w-full h-full bg-slate-100"><canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} className="w-full h-full cursor-crosshair" style={{ touchAction: 'none' }} /></div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="p-4 space-y-6 bg-slate-50 min-h-full">
            <div className="flex justify-between items-center"><h2 className="text-lg font-bold text-slate-700 px-1 flex items-center gap-2"><ImageIcon className="text-indigo-500" /> 班級相簿</h2></div>
            {Object.keys(photosByDate).length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-slate-300"><ImageIcon size={48} className="mb-4 text-slate-200" /><p>無照片</p></div> : Object.entries(photosByDate).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, dayPhotos]) => (<div key={date} className="space-y-2"><div className="sticky top-0 bg-slate-50/95 backdrop-blur py-2 z-10"><h3 className="text-sm font-bold text-slate-500">{date}</h3></div><div className="grid grid-cols-3 gap-2">{dayPhotos.map(photo => (<div key={photo.id} onClick={() => setSelectedPhoto(photo)} className="aspect-square rounded-lg overflow-hidden relative group cursor-pointer bg-slate-200 shadow-sm"><img src={photo.imageUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" /></div>))}</div></div>))}
          </div>
        )}

        {/* POMODORO */}
        {activeTab === 'pomodoro' && (
          <div className={`h-full flex flex-col items-center justify-center p-6 transition-colors duration-500 ${pomoMode === 'focus' ? 'bg-indigo-900 text-white' : 'bg-emerald-600 text-white'}`}>
            <div className="text-center space-y-8 animate-in zoom-in duration-300">
              <div className="inline-block p-4 rounded-full bg-white/10 backdrop-blur-lg mb-4">{pomoMode === 'focus' ? <BrainCircuit size={48} className="text-indigo-200" /> : <Coffee size={48} className="text-emerald-200" />}</div>
              <h2 className="text-3xl font-bold tracking-widest">{pomoMode === 'focus' ? '專注時間' : '休息時間'}</h2>
              <div className="text-[6rem] font-bold font-mono leading-none tracking-tighter tabular-nums text-shadow-lg">{formatTime(pomoTime)}</div>
              <div className="flex gap-6 justify-center"><button onClick={toggleTimer} className="p-6 rounded-full bg-white text-indigo-900 hover:scale-110 transition-transform shadow-xl flex items-center justify-center">{pomoIsActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}</button><button onClick={resetTimer} className="p-6 rounded-full bg-white/20 hover:bg-white/30 text-white hover:scale-110 transition-all shadow-lg flex items-center justify-center"><RotateCcw size={32} /></button></div>
              <div className="flex gap-4 justify-center mt-8"><button onClick={() => switchPomoMode('focus')} className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${pomoMode === 'focus' ? 'bg-white text-indigo-900' : 'bg-transparent border border-white/30 text-white/60 hover:bg-white/10'}`}>專注 (25m)</button><button onClick={() => switchPomoMode('break')} className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${pomoMode === 'break' ? 'bg-white text-emerald-800' : 'bg-transparent border border-white/30 text-white/60 hover:bg-white/10'}`}>休息 (5m)</button></div>
            </div>
          </div>
        )}
      </main>

      {/* FAB - Granular Permission Checks */}
      <div className="absolute bottom-20 right-4 z-20 flex flex-col gap-3">
        {activeTab === 'photos' && hasPermission('manage_photos') && <button onClick={() => setIsPhotoUploadOpen(true)} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all"><Upload size={24} /></button>}
        
        {/* Conditional FAB for other tabs */}
        {activeTab === 'calendar' && hasPermission('manage_calendar') && <button onClick={() => setIsEventModalOpen(true)} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all"><Plus size={24} /></button>}
        {activeTab === 'notices' && hasPermission('manage_notices') && <button onClick={() => setIsNoticeModalOpen(true)} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all"><Plus size={24} /></button>}
        {activeTab === 'tasks' && hasPermission('manage_tasks') && <button onClick={() => setIsTaskModalOpen(true)} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all"><Plus size={24} /></button>}
      </div>

      {/* NAV */}
      <nav className="bg-white border-t border-slate-200 h-16 grid grid-cols-6 items-center justify-items-center absolute bottom-0 w-full z-10 px-1">
        <button onClick={()=>setActiveTab('calendar')} className={`flex flex-col items-center gap-1 ${activeTab==='calendar'?'text-indigo-600':'text-slate-400'}`}><Calendar size={20}/><span className="text-[9px]">行事曆</span></button>
        <button onClick={()=>setActiveTab('tasks')} className={`flex flex-col items-center gap-1 ${activeTab==='tasks'?'text-indigo-600':'text-slate-400'}`}><CheckSquare size={20}/><span className="text-[9px]">任務</span></button>
        <button onClick={()=>setActiveTab('photos')} className={`flex flex-col items-center gap-1 ${activeTab==='photos'?'text-indigo-600':'text-slate-400'}`}><ImageIcon size={20}/><span className="text-[9px]">相簿</span></button>
        <button onClick={()=>setActiveTab('notices')} className={`flex flex-col items-center gap-1 ${activeTab==='notices'?'text-indigo-600':'text-slate-400'}`}><Bell size={20}/><span className="text-[9px]">公告</span></button>
        <button onClick={()=>setActiveTab('whiteboard')} className={`flex flex-col items-center gap-1 ${activeTab==='whiteboard'?'text-indigo-600':'text-slate-400'}`}><Palette size={20}/><span className="text-[9px]">白板</span></button>
        <button onClick={()=>setActiveTab('pomodoro')} className={`flex flex-col items-center gap-1 ${activeTab==='pomodoro'?'text-indigo-600':'text-slate-400'}`}><Timer size={20}/><span className="text-[9px]">專注</span></button>
      </nav>

      {/* GLOBAL ALERT/CONFIRM MODAL */}
      <Modal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        onConfirm={modalConfig.onConfirm} 
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        isAlert={modalConfig.isAlert}
      />

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><School size={20}/> 班級資訊</h3>
              <button onClick={()=>setIsSettingsOpen(false)}><X size={24} className="text-slate-400"/></button>
            </div>
            <div className="space-y-6">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100"><div className="text-xs text-indigo-400 font-bold mb-1 uppercase tracking-wider">班級名稱</div><div className="text-xl font-bold text-indigo-900">{classroom?.name}</div></div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative"><div className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">邀請碼 (點擊複製)</div><button onClick={copyInviteCode} className="text-3xl font-mono font-bold text-slate-800 tracking-widest w-full text-left flex items-center justify-between group">{classroom?.inviteCode}<Copy size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" /></button></div>
              <div className="pt-4 border-t border-slate-100"><button onClick={handleLeaveClass} className="w-full py-3 rounded-xl border border-red-200 text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"><LogOut size={18} />離開班級 (退群)</button><p className="text-center text-xs text-slate-300 mt-3">注意：離開後將無法存取班級資料</p></div>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER MANAGEMENT & ROLE EDITOR MODAL */}
      {isManageMembersOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">成員管理</h3><button onClick={()=>setIsManageMembersOpen(false)}><X size={24}/></button></div>
            
            {isRoleEditOpen && editingMember ? (
              // SUB-VIEW: ROLE EDITOR
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="flex items-center gap-3 mb-4 bg-slate-50 p-3 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">{editingMember.displayName[0]}</div>
                  <div><div className="font-bold text-lg">{editingMember.displayName}</div><div className="text-xs text-slate-400">正在編輯權限</div></div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">自訂職稱</label>
                  <input type="text" value={editRoleTitle} onChange={e => setEditRoleTitle(e.target.value)} className="w-full border rounded-lg p-2" placeholder="例如: 總務股長" />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500">權限設定</label>
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <div key={key} onClick={() => togglePermission(key as PermissionType)} className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer transition-colors ${editPermissions.includes(key as PermissionType) ? 'bg-indigo-50 border-indigo-200' : 'border-slate-100'}`}>
                      <span className={`text-sm ${editPermissions.includes(key as PermissionType) ? 'text-indigo-700 font-bold' : 'text-slate-600'}`}>{label}</span>
                      {editPermissions.includes(key as PermissionType) ? <CheckCircle size={18} className="text-indigo-500"/> : <Circle size={18} className="text-slate-300"/>}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t mt-4">
                  <div onClick={() => setEditIsTeacher(!editIsTeacher)} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                    <div className={`w-5 h-5 border rounded flex items-center justify-center ${editIsTeacher ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{editIsTeacher && <CheckCircle size={14} className="text-white"/>}</div>
                    <span className="text-sm font-bold text-slate-700">設為導師 (擁有所有權限)</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button onClick={() => setIsRoleEditOpen(false)} className="flex-1 py-2 text-slate-500">取消</button>
                  <button onClick={saveRoleSettings} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold">儲存設定</button>
                </div>
              </div>
            ) : (
              // MAIN LIST VIEW
              <div className="overflow-y-auto flex-1 space-y-2">
                {allUsers.filter(u=>u.uid!==user.uid).map(m=>(
                  <div key={m.uid} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isTeacher(m.uid)?'bg-yellow-100 text-yellow-600': m.permissions?.length ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        {isTeacher(m.uid) ? <Briefcase size={16}/> : m.permissions?.length ? <Crown size={16}/> : <User size={16}/>}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{m.displayName}</div>
                        <div className="text-xs text-slate-400">
                          {isTeacher(m.uid) ? '導師' : m.customRoleTitle || '同學'}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => openRoleEditor(m)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full"><Edit3 size={16}/></button>
                  </div>
                ))}
                {allUsers.length<=1 && <p className="text-center text-slate-400 py-4">尚無其他成員</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OTHER MODALS (Add Event, Notice) - Same as before */}
      {isEventModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">新增事項</h3><button onClick={()=>setIsEventModalOpen(false)}><X size={24}/></button></div>
            <div className="space-y-4">
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-3" />
              <input type="text" placeholder="標題" value={newEventTitle} onChange={e=>setNewEventTitle(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-3" />
              <div className="flex gap-2">{(['homework','exam','activity','other'] as EventType[]).map(t=><button key={t} onClick={()=>setNewEventType(t)} className={`flex-1 py-2 text-xs border rounded ${newEventType===t?'bg-indigo-50 border-indigo-500 text-indigo-700':''}`}>{t}</button>)}</div>
              <button onClick={handleAddEvent} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">確認</button>
            </div>
          </div>
        </div>
      )}
      {isNoticeModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">發布公告</h3><button onClick={()=>setIsNoticeModalOpen(false)}><X size={24}/></button></div>
            <div className="space-y-4">
              <input type="text" placeholder="標題" value={newNoticeTitle} onChange={e=>setNewNoticeTitle(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-3" />
              <textarea rows={4} placeholder="內容" value={newNoticeContent} onChange={e=>setNewNoticeContent(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-3 resize-none" />
              <button onClick={()=>setIsNoticeImportant(!isNoticeImportant)} className={`flex items-center gap-2 text-sm ${isNoticeImportant?'text-red-500':'text-slate-500'}`}><div className={`w-4 h-4 border ${isNoticeImportant?'bg-red-500':''}`}></div> 重要公告</button>
              <button onClick={handleAddNotice} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">發布</button>
            </div>
          </div>
        </div>
      )}
      
      {/* TASK MODAL - UPDATED WITH COLOR PICKER */}
      {isTaskModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">指派任務</h3><button onClick={()=>setIsTaskModalOpen(false)}><X size={24}/></button></div>
            <div className="space-y-4">
              <input type="text" placeholder="任務名稱" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-3" />
              <div className="flex gap-2">
                 <select value={newTaskWeek} onChange={e=>setNewTaskWeek(e.target.value)} className="flex-1 bg-slate-50 border rounded-lg p-3">{[...Array(20)].map((_,i)=><option key={i} value={`第${i+1}週`}>第{i+1}週</option>)}</select>
                 <input type="date" value={newTaskDueDate} onChange={e=>setNewTaskDueDate(e.target.value)} className="flex-1 bg-slate-50 border rounded-lg p-3" />
              </div>
              <select value={newTaskAssignee} onChange={e=>setNewTaskAssignee(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-3"><option value="">選擇對象...</option>{allUsers.map(u=><option key={u.uid} value={u.uid}>{u.displayName} ({getRoleLabel(u.role)})</option>)}</select>
              
              {/* Task Color Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">行事曆標籤顏色</label>
                <div className="flex gap-2">
                  {TASK_COLORS.map((color, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setNewTaskColor(color.value)}
                      className={`w-8 h-8 rounded-full border-2 ${color.bg} ${newTaskColor === color.value ? 'border-indigo-600 scale-110 shadow' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>

              <button onClick={handleAddTask} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">指派</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Photo Upload Modal - Same as before */}
      {isPhotoUploadOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">上傳照片</h3><button onClick={()=>setIsPhotoUploadOpen(false)}><X size={24}/></button></div>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">活動日期</label><input type="date" value={photoDate} onChange={e=>setPhotoDate(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-3" /></div>
              <div><label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"><div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-400">{isUploadingPhoto ? <RefreshCw className="animate-spin mb-2" /> : <Upload className="mb-2" />}<p className="text-xs">{isUploadingPhoto ? '處理中...' : '點擊選擇照片 (自動壓縮)'}</p></div><input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploadingPhoto} /></label></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Photo View Modal - Same as before */}
      {selectedPhoto && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg">
            <button onClick={()=>setSelectedPhoto(null)} className="absolute -top-12 right-0 text-white p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
            <img src={selectedPhoto.imageUrl} alt="" className="w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
            <div className="mt-4 flex justify-between items-center text-white">
              <div><p className="font-bold text-sm">{selectedPhoto.date}</p><p className="text-xs text-white/60">上傳者: {selectedPhoto.uploadedByName}</p></div>
              {(user.uid === selectedPhoto.uploadedBy || hasPermission('manage_photos')) && <button onClick={() => handleDeletePhoto(selectedPhoto.id)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={20}/></button>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
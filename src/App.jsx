import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import "./App.css";
import Header from "./Components/Header";
import Home from "./Page/Home";
import Footer from "./Components/Footer";
import VisitTracker from "./Components/VisitTracker";
import ErrorBoundary from "./Components/ErrorBoundary";
import BootLoader from "./Components/BootLoader";
import PageTransition from "./Components/PageTransition";
import Cursor from "./Components/Cursor";

/* Home stays in the main chunk (it is the LCP page); every other route is
   split so the first paint does not wait for the admin panel or the blog. */
const About = lazy(() => import("./Page/About"));
const Project = lazy(() => import("./Page/Project"));
const Blog = lazy(() => import("./Page/Blog"));
const BlogPost = lazy(() => import("./Page/Blog/Post"));
const Contact = lazy(() => import("./Page/Contact"));
const NotFound = lazy(() => import("./Page/NotFound"));
const AdminApp = lazy(() => import("./Page/Admin/AdminApp"));

function RouteFallback() {
  return (
    <div
      className="flex items-center justify-center bg-[#0F172B]"
      style={{ minHeight: "calc(100vh - 116px)" }}
    >
      <span className="text-[#615FFF] text-[12px] font-mono animate-pulse">loading…</span>
    </div>
  );
}

function PublicSite() {
  const location = useLocation();

  // ---- Boot loader: run once per session (sessionStorage keeps it from
  // re-appearing on every in-app navigation back to the site) ----
  const [booted, setBooted] = useState(() => {
    try {
      return sessionStorage.getItem("booted") === "1";
    } catch {
      return false;
    }
  });
  const handleBooted = useCallback(() => {
    try {
      sessionStorage.setItem("booted", "1");
    } catch {
      /* private mode */
    }
    setBooted(true);
  }, []);

  // Simple, clean route transition key
  const [transitioning, setTransitioning] = useState(false);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setTransitioning(true);
      const timer = setTimeout(() => setTransitioning(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  return (
    <>
      <VisitTracker />
      {!booted && <BootLoader onDone={handleBooted} />}
      <Header />
      <PageTransition active={transitioning} path={location.pathname} />
      <ErrorBoundary key={location.pathname}>
        <div className="page-reveal" key={location.pathname} style={{ minHeight: "calc(100vh - 116px)" }}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/project" element={<Project />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </ErrorBoundary>
      <Footer />
    </>
  );
}

function App() {
  return (
    <>
      <Cursor />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*" element={<PublicSite />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;

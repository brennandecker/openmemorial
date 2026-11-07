import React from "react";
import {createRoot} from "react-dom/client";
import {lazy, Suspense} from "react";
import PhotoWall from "./PhotoWall";
const MemorialPage = lazy(() => import("./MemorialPage"));
const FamilyReview = lazy(() => import("./FamilyReview"));
const SitePages = lazy(() => import("./SitePages"));
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "");
const page = path === "/privacy" ? "privacy" : path === "/terms" ? "terms" : path === "/login" ? "login" : null;
createRoot(document.getElementById("root")!).render(<React.StrictMode>{page ? <Suspense fallback={null}><SitePages page={page} /></Suspense> : path === "/family" ? <Suspense fallback={null}><FamilyReview /></Suspense> : path === "/studio" ? <Suspense fallback={null}><MemorialPage studio /></Suspense> : <PhotoWall />}</React.StrictMode>);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import HomePage from "./pages/HomePage";
import ProjectPage from "./pages/ProjectPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="p/:projectId" element={<ProjectPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

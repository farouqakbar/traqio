/* TRAQIO — CV / Resume page
 * Upload, preview, and manage CV versions.
 * In DEMO_MODE we use a localStorage store for file metadata (no real upload).
 * In production, swap the upload handler for a Supabase Storage call.
 */
(function () {
  const I = (n) => window.Traqio.icons.render(n);
  const CV_KEY = "traqio:cvs:v1";

  const TIPS = [
    { title: "One page for early career", desc: "Keep it to one page unless you have 10+ years of experience." },
    { title: "Tailor per role", desc: "Upload a custom version for each target role type. Name them clearly." },
    { title: "Quantify everything", desc: "\"Improved dashboard load time by 60%\" beats \"improved performance\"." },
    { title: "ATS-friendly format", desc: "Use simple layout — no columns, tables, or text boxes. Recruiters use bots." },
    { title: "PDF, always", desc: "Submit as PDF to preserve formatting across devices." },
  ];

  function loadCVs() {
    try {
      const raw = localStorage.getItem(CV_KEY);
      return raw ? JSON.parse(raw) : getDemoCVs();
    } catch { return getDemoCVs(); }
  }

  function getDemoCVs() {
    return [];
  }

  function saveCVs(list) {
    // don't persist objectUrls as they're session-only
    const safe = list.map(c => ({ ...c, objectUrl: null }));
    localStorage.setItem(CV_KEY, JSON.stringify(safe));
  }

  let cvList = loadCVs();
  let selectedId = cvList[0]?.id || null;

  function selectedCV() { return cvList.find(c => c.id === selectedId); }

  function render() {
    const selected = selectedCV();
    const html = `
      <main class="page">
        <div class="page-header">
          <div class="titles"><h1>CV / Resume</h1><p>Upload and manage your CV versions — always have the right one ready to send.</p></div>
          <button class="btn btn-primary" id="uploadTriggerBtn">${I("upload")} Upload CV</button>
        </div>
        <input type="file" id="cvFileInput" accept=".pdf,.doc,.docx" style="display:none" />

        <div class="cv-layout">
          <div>
            ${renderUploadZone()}
            ${renderFileList()}
            ${selected && cvUrl(selected) ? renderPreview(selected) : renderPreviewPlaceholder()}
          </div>
          <div>
            ${renderSidebar()}
          </div>
        </div>
      </main>`;

    window.Traqio.shell.mount("cv", html);
    wireEvents();
  }

  function renderUploadZone() {
    return `
      <div class="upload-zone" id="uploadZone">
        <div class="upload-ico">${I("upload")}</div>
        <h3>Drop your CV here</h3>
        <p>Drag &amp; drop a PDF or Word document, or <b>click to browse</b></p>
        <div class="filetypes"><span>PDF</span><span>DOC</span><span>DOCX</span></div>
      </div>`;
  }

  function cvUrl(cv) {
    return cv.storageUrl || cv.objectUrl || null;
  }

  function renderFileList() {
    if (!cvList.length) return "";
    return cvList.map(cv => {
      const url = cvUrl(cv);
      return `
      <div class="cv-file-card ${cv.id === selectedId ? "active" : ""}" data-cvid="${cv.id}">
        <div class="file-ico pdf">${I("file")}</div>
        <div class="body">
          <div class="name">${cv.name}</div>
          <div class="meta">${cv.size} · Uploaded ${fmt(cv.uploaded)} ${cv.tag ? `· <b>${cv.tag}</b>` : ""} ${cv.storageUrl ? "☁️" : ""}</div>
        </div>
        <div class="actions">
          ${url ? `<a class="btn btn-ghost btn-sm" href="${url}" target="_blank" download="${cv.name}" title="Download">${I("upload")}</a>` : ""}
          <button class="btn btn-ghost btn-sm del-cv" data-cvid="${cv.id}" title="Delete">${I("trash")}</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderPreview(cv) {
    const url = cvUrl(cv);
    return `
      <div class="pdf-preview">
        <div class="pdf-toolbar">
          <div class="name">${I("file")} ${cv.name}</div>
          <a class="btn btn-secondary btn-sm" href="${url}" target="_blank" download="${cv.name}">${I("upload")} Download</a>
        </div>
        <iframe class="pdf-frame" src="${url}" title="CV Preview"></iframe>
      </div>`;
  }

  function renderPreviewPlaceholder() {
    return `
      <div class="pdf-preview" style="padding:48px;text-align:center">
        <div class="empty-state">
          <div class="icon">${I("file")}</div>
          <h3>No preview available</h3>
          <p>Upload a PDF to see a live preview here, or select an uploaded CV from the list above.</p>
          <button class="btn btn-primary" id="uploadTriggerBtn2" style="margin-top:14px">${I("upload")} Upload your CV</button>
        </div>
      </div>`;
  }

  function renderSidebar() {
    const tips = TIPS.map((t, i) => `
      <div class="tip-item">
        <div class="num">${i + 1}</div>
        <div class="body"><div class="title">${t.title}</div><div class="desc">${t.desc}</div></div>
      </div>`).join("");

    const versionHtml = cvList.map(cv => `
      <div class="version-item">
        <div class="v-ico">${I("file")}</div>
        <div class="body">
          <div class="name">${cv.name}</div>
          <div class="meta">${cv.size} · ${fmt(cv.uploaded)}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost btn-sm tag-cv" data-cvid="${cv.id}" title="Tag as Primary">${I("bookmark")}</button>
          <button class="btn btn-danger btn-sm del-cv" data-cvid="${cv.id}" title="Delete">${I("trash")}</button>
        </div>
      </div>`).join("");

    return `
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="card card-pad">
          <div style="display:flex;align-items:center;gap:8px;font-size:1rem;font-weight:700;margin-bottom:14px">${I("folder")} Your CVs (${cvList.length})</div>
          ${cvList.length ? `<div class="version-list">${versionHtml}</div>` : `<div class="empty-state" style="padding:16px 0"><p>No CVs uploaded yet.</p></div>`}
        </div>
        <div class="card card-pad">
          <div style="display:flex;align-items:center;gap:8px;font-size:1rem;font-weight:700;margin-bottom:14px">${I("sparkles")} CV Tips</div>
          ${tips}
        </div>
      </div>`;
  }

  function fmt(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function wireEvents() {
    document.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = window.Traqio.icons.render(el.getAttribute("data-icon")) || ""; });

    const fileInput = document.getElementById("cvFileInput");
    const zone = document.getElementById("uploadZone");

    function triggerUpload() { fileInput?.click(); }
    document.getElementById("uploadTriggerBtn")?.addEventListener("click", triggerUpload);
    document.getElementById("uploadTriggerBtn2")?.addEventListener("click", triggerUpload);
    zone?.addEventListener("click", triggerUpload);

    // Drag & drop
    zone?.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone?.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone?.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
      e.target.value = "";
    });

    // CV file card select
    document.querySelectorAll(".cv-file-card[data-cvid]").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".del-cv") || e.target.closest("a")) return;
        selectedId = card.dataset.cvid;
        render();
      });
    });

    // Delete CV
    document.querySelectorAll(".del-cv").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("Delete this CV version?")) return;
        const id = btn.dataset.cvid;
        const cv = cvList.find(c => c.id === id);
        cvList = cvList.filter(c => c.id !== id);
        saveCVs(cvList);
        if (selectedId === id) selectedId = cvList[0]?.id || null;
        window.Traqio.toast("CV deleted", "success");
        render();
        if (cv?.storageUrl) {
          window.Traqio?.supabase?.cvFiles?.remove(cv.storageUrl).catch(() => {});
        }
      });
    });

    // Tag as primary
    document.querySelectorAll(".tag-cv").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.cvid;
        cvList = cvList.map(c => ({ ...c, tag: c.id === id ? "Primary" : (c.tag === "Primary" ? "" : c.tag) }));
        saveCVs(cvList);
        window.Traqio.toast("Marked as primary", "success");
        render();
      });
    });
  }

  async function handleFile(file) {
    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      window.Traqio.toast("Only PDF and Word files are supported", "error");
      return;
    }
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    if (parseFloat(sizeMB) > 10) {
      window.Traqio.toast("File must be under 10 MB", "error");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const sizeLabel = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${Math.round(file.size / 1024)} KB`;
    const isPdf = file.type === "application/pdf";
    const newCV = {
      id: "cv" + Date.now(),
      name: file.name,
      size: sizeLabel,
      type: isPdf ? "pdf" : "doc",
      uploaded: new Date().toISOString().slice(0, 10),
      tag: cvList.length === 0 ? "Primary" : "",
      objectUrl,
      storageUrl: null,
    };
    cvList.unshift(newCV);
    saveCVs(cvList);
    selectedId = newCV.id;
    window.Traqio.toast("CV uploaded ✓", "success");
    render();

    // Upload to Supabase Storage for cross-device persistence
    const cfg = window.TRAQIO_CONFIG || {};
    if (!cfg.DEMO_MODE && window.Traqio?.supabase?.cvFiles) {
      try {
        window.Traqio.toast("Syncing to cloud…");
        const storageUrl = await window.Traqio.supabase.cvFiles.upload(file);
        newCV.storageUrl = storageUrl;
        saveCVs(cvList);
        window.Traqio.toast("CV saved to cloud ☁️", "success");
        render();
      } catch (e) {
        console.warn("CV cloud upload failed:", e.message);
      }
    }
  }

  setTimeout(render, 0);

  // CV data lives in its own localStorage key — no need to react to store:change
  document.addEventListener("traqio:lang-change", render);
})();

import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

const SECTIONS = [
  { id: 'getting-started',   label: 'Getting Started' },
  { id: 'projects',          label: 'Projects & Modules' },
  { id: 'requirements',      label: 'Requirements' },
  { id: 'tags',              label: 'Tags' },
  { id: 'traceability',      label: 'Traceability' },
  { id: 'wiki',              label: 'Wiki Editor' },
  { id: 'ai-import',         label: 'AI Import' },
  { id: 'reports',           label: 'Reports & Baselines' },
  { id: 'user-management',   label: 'User Management' },
  { id: 'account',           label: 'Your Account' },
];

function Section({ id, title, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 24 }}>
      <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </h2>
        <div style={{ color: 'var(--text)', lineHeight: 1.7, fontSize: 14 }}>
          {children}
        </div>
      </div>
    </section>
  );
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
        background: 'var(--primary)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, marginTop: 1,
      }}>{n}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Note({ children }) {
  return (
    <div style={{
      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
      padding: '10px 14px', margin: '12px 0', fontSize: 13, color: '#1e40af',
    }}>
      <strong>Note: </strong>{children}
    </div>
  );
}

function Tip({ children }) {
  return (
    <div style={{
      background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
      padding: '10px 14px', margin: '12px 0', fontSize: 13, color: '#166534',
    }}>
      <strong>Tip: </strong>{children}
    </div>
  );
}

function Field({ name, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{
        display: 'inline-block', background: '#f1f5f9', borderRadius: 4,
        padding: '1px 7px', fontFamily: 'monospace', fontSize: 12,
        fontWeight: 600, color: 'var(--text)', marginRight: 8,
      }}>{name}</span>
      {children}
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = {
    admin:   { bg: '#fef2f2', color: '#dc2626' },
    manager: { bg: '#fffbeb', color: '#d97706' },
    viewer:  { bg: '#f0fdf4', color: '#16a34a' },
  };
  const c = colors[role] || colors.viewer;
  return (
    <span style={{
      display: 'inline-block', borderRadius: 4, padding: '1px 8px',
      fontSize: 11, fontWeight: 700, background: c.bg, color: c.color,
    }}>{role}</span>
  );
}

function H3({ children }) {
  return <h3 style={{ margin: '20px 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{children}</h3>;
}

export default function UserGuidePage() {
  const { user } = useAuth();
  const [active, setActive] = useState('getting-started');
  const contentRef = useRef(null);

  // Highlight the ToC item whose section is in view
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    function onScroll() {
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 80) {
          current = s.id;
        }
      }
      setActive(current);
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) {
      contentRef.current?.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
    }
    setActive(id);
  }

  return (
    <Layout>
      <div className="page" style={{ display: 'flex', gap: 0, padding: 0, height: '100%', overflow: 'hidden' }}>
        {/* Table of Contents */}
        <aside style={{
          width: 210, flexShrink: 0, padding: '24px 0',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '0 16px 12px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>
            Contents
          </div>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active === s.id ? 700 : 400,
                color: active === s.id ? 'var(--primary)' : 'var(--text)',
                borderLeft: active === s.id ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all .15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </aside>

        {/* Scrollable content */}
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* ── Getting Started ───────────────────────────────────────── */}
          <Section id="getting-started" title="Getting Started">
            <p>
              <strong>ReqPlan</strong> is a requirements management application that helps teams
              capture, organise, and track software or product requirements across projects.
              Everything is organised around <em>Projects → Modules → Requirements</em>.
            </p>

            <H3>Roles</H3>
            <p>Every user account is assigned one of three roles:</p>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 8 }}><RoleBadge role="admin" /> — Full access: manage users, tags, projects, requirements, and baselines.</div>
              <div style={{ marginBottom: 8 }}><RoleBadge role="manager" /> — Can create and edit projects, requirements, and tags; cannot manage user accounts.</div>
              <div><RoleBadge role="viewer" /> — Read-only access to all projects and requirements.</div>
            </div>

            <H3>Logging In</H3>
            <Step n={1}>Open the application and enter your <strong>username</strong> and <strong>password</strong> on the login page.</Step>
            <Step n={2}>Click <strong>Sign In</strong>. You will be taken to the Dashboard.</Step>
            <Step n={3}>To register a new account yourself, click <strong>Register</strong> on the login page. New self-registered accounts are assigned the <RoleBadge role="viewer" /> role by default. An admin can promote your role later.</Step>

            <H3>Navigation</H3>
            <p>
              Use the <strong>sidebar</strong> on the left to move between sections. The links
              available depend on your role — admin-only pages such as <em>Users</em> are hidden
              for non-admin accounts.
            </p>
          </Section>

          {/* ── Projects & Modules ────────────────────────────────────── */}
          <Section id="projects" title="Projects & Modules">
            <p>
              Projects are the top-level containers for all your requirements. Each project
              can be further divided into <strong>Modules</strong> — logical sub-areas such as
              "Authentication", "Payment", or "API".
            </p>

            <H3>Creating a Project</H3>
            <Step n={1}>Click <strong>Projects</strong> in the sidebar.</Step>
            <Step n={2}>Click <strong>+ New Project</strong>.</Step>
            <Step n={3}>Enter a <strong>Name</strong> and optional <strong>Description</strong>, then click <strong>Create</strong>.</Step>

            <H3>Adding Modules</H3>
            <Step n={1}>Open a project by clicking its name in the Projects list.</Step>
            <Step n={2}>In the project detail page, click <strong>+ Add Module</strong>.</Step>
            <Step n={3}>Enter the module name and save. Modules appear in the sidebar of the project and can be used to filter requirements.</Step>

            <H3>Exporting a Project to Word</H3>
            <p>
              On the project detail page, click <strong>Export to Word</strong> to download a
              <strong> .docx</strong> document containing all requirements, traceability links, and the
              traceability matrix for that project.
            </p>

            <Tip>Modules are optional. If you don't need sub-divisions, you can add requirements directly to a project without assigning a module.</Tip>
          </Section>

          {/* ── Requirements ──────────────────────────────────────────── */}
          <Section id="requirements" title="Requirements">
            <p>
              Requirements are the core records in ReqPlan. Each requirement belongs to a project
              and can optionally be placed in a module.
            </p>

            <H3>Creating a Requirement</H3>
            <Step n={1}>Click <strong>Requirements</strong> in the sidebar (or open a project and click <strong>+ New Requirement</strong>).</Step>
            <Step n={2}>Click <strong>+ New Requirement</strong>.</Step>
            <Step n={3}>Fill in the fields and click <strong>Save</strong>.</Step>

            <div style={{ marginTop: 12 }}>
              <Field name="Title">Short, descriptive name for the requirement. Required.</Field>
              <Field name="Project">The project this requirement belongs to. Required.</Field>
              <Field name="Module">Optional sub-area within the project.</Field>
              <Field name="Status">
                Current state: <em>draft</em>, <em>active</em>, <em>review</em>, <em>approved</em>, or <em>deprecated</em>.
              </Field>
              <Field name="Priority"><em>low</em>, <em>medium</em>, <em>high</em>, or <em>critical</em>.</Field>
              <Field name="Description">Full details, acceptance criteria, or notes. Supports plain text.</Field>
            </div>

            <H3>Editing & Deleting</H3>
            <p>
              Click a requirement's title to open its detail page. From there you can
              <strong> edit</strong> any field, <strong>delete</strong> the requirement, assign tags, and
              manage traceability links.
            </p>

            <H3>Filtering & Searching</H3>
            <p>
              On the Requirements list page use the filter bar to narrow results by
              <strong> project</strong>, <strong>module</strong>, <strong>status</strong>,
              <strong> priority</strong>, or <strong>tag</strong>. You can also type in the
              <strong> search box</strong> to match by requirement ID or title keyword.
            </p>

            <Tip>Each requirement is automatically assigned a unique ID (e.g. <code>REQ-0001</code>) when it is created. This ID never changes and is used in exports and traceability links.</Tip>
          </Section>

          {/* ── Tags ──────────────────────────────────────────────────── */}
          <Section id="tags" title="Tags">
            <p>
              Tags are free-form labels you can attach to requirements for cross-cutting
              concerns — for example <em>security</em>, <em>performance</em>, or <em>MVP</em>.
            </p>

            <H3>Managing Tags</H3>
            <p>
              Admins and managers can create and delete tags via the <strong>Tags</strong> page
              (visible in the sidebar for admin/manager roles).
            </p>
            <Step n={1}>Click <strong>Tags</strong> in the sidebar.</Step>
            <Step n={2}>Enter a tag name and pick a colour, then click <strong>Create</strong>.</Step>
            <Step n={3}>To delete a tag, click the <strong>✕</strong> next to it. Removing a tag also unlinks it from all requirements.</Step>

            <H3>Assigning Tags to Requirements</H3>
            <Step n={1}>Open a requirement's detail page.</Step>
            <Step n={2}>In the <strong>Tags</strong> section, select a tag from the dropdown and click <strong>Add</strong>.</Step>
            <Step n={3}>To remove a tag from a requirement, click the <strong>✕</strong> on the tag chip.</Step>

            <Note>Viewers can see tags but cannot create, delete, or assign them.</Note>
          </Section>

          {/* ── Traceability ──────────────────────────────────────────── */}
          <Section id="traceability" title="Traceability">
            <p>
              Traceability links connect requirements to each other to express relationships
              such as dependencies, refinements, or conflicts.
            </p>

            <H3>Link Types</H3>
            <div style={{ marginBottom: 12 }}>
              <Field name="depends_on">This requirement cannot be fulfilled without the target being met first.</Field>
              <Field name="relates_to">A general association between two requirements.</Field>
              <Field name="refines">This requirement provides more detail on the target.</Field>
              <Field name="conflicts_with">This requirement is in tension with the target.</Field>
            </div>

            <H3>Adding a Link</H3>
            <Step n={1}>Open a requirement's detail page.</Step>
            <Step n={2}>Scroll to the <strong>Traceability Links</strong> section.</Step>
            <Step n={3}>Select a <strong>Link Type</strong> and search for the <strong>Target Requirement</strong>.</Step>
            <Step n={4}>Click <strong>Add Link</strong>. The link is shown in both the source and target requirement.</Step>

            <H3>Traceability Matrix</H3>
            <p>
              Click <strong>Traceability</strong> in the sidebar to see the full matrix view.
              Use the project filter to focus on one project. Each row is a source requirement;
              columns show targets. Click any cell to navigate to the source requirement.
            </p>

            <Tip>Use the Traceability page to quickly spot requirements that have no links — these may indicate gaps in your coverage analysis.</Tip>
          </Section>

          {/* ── Wiki Editor ─────────────────────────────────────────── */}
          <Section id="wiki" title="Wiki Editor">
            <p>
              ReqPlan includes a full-featured WYSIWYG wiki editor for documenting modules and
              projects, with deep integration into the requirement management system.
            </p>

            <H3>Per-Module Wiki</H3>
            <p>
              Each module automatically gets its own wiki page. Open a module and switch to the
              <strong> Wiki</strong> tab to start editing. Content auto-saves as you type.
            </p>
            <Step n={1}>Navigate to a module detail page.</Step>
            <Step n={2}>Click the <strong>Wiki</strong> tab.</Step>
            <Step n={3}>Start writing. Changes are saved automatically after a short delay — a status indicator shows <em>Saving...</em> and then <em>Saved</em>.</Step>

            <H3>Standalone Wiki Pages</H3>
            <p>
              The <strong>Wiki</strong> item in the sidebar opens a project-scoped wiki with a
              hierarchical page tree. Create top-level pages and nested sub-pages to organise
              cross-cutting documentation (architecture, standards, glossary, etc.).
            </p>
            <Step n={1}>Click <strong>Wiki</strong> in the sidebar.</Step>
            <Step n={2}>Select a project, then click <strong>+ New Page</strong> to create a top-level page, or click <strong>+</strong> next to an existing page to create a sub-page.</Step>
            <Step n={3}>Click a page title in the tree to open and edit it.</Step>

            <H3>Requirement References (@-mentions)</H3>
            <p>
              Type <strong>@</strong> in the editor to search for requirements by ID or title.
              Select one from the autocomplete list to insert a clickable reference badge
              (e.g. <code>REQ-0001</code>) that links directly to the requirement detail page.
            </p>

            <H3>Inline Requirement Creation</H3>
            <Step n={1}>Select text in the editor that describes a requirement.</Step>
            <Step n={2}>Click <strong>+ Req</strong> in the floating toolbar.</Step>
            <Step n={3}>Fill in the requirement details in the modal — the selected text is pre-filled as the title.</Step>
            <Step n={4}>Click <strong>Create</strong>. The selected text is automatically replaced with a reference badge linking to the new requirement.</Step>

            <H3>Export to Wiki</H3>
            <p>
              From the module detail page, click <strong>Export to Wiki</strong> to generate a
              formatted requirements table (ID, title, status, priority, tags) and append it to
              the module's existing wiki content under a "Requirements" heading. Existing wiki
              content is always preserved — the table is added at the end.
            </p>

            <H3>Editor Capabilities</H3>
            <p>
              The editor supports 40+ extensions including:
            </p>
            <div style={{ marginBottom: 12 }}>
              <Field name="Formatting">Bold, italic, underline, strikethrough, code, subscript, superscript, text colour, highlight</Field>
              <Field name="Typography">Font family, font size, line height</Field>
              <Field name="Structure">H1–H6 headings, text alignment, indent/outdent, blockquotes, horizontal rules, callout boxes</Field>
              <Field name="Lists">Bullet lists, ordered lists, task/checkbox lists</Field>
              <Field name="Tables">Resizable tables with header rows and a bubble menu for table operations</Field>
              <Field name="Media">Images, videos, embedded iframes</Field>
              <Field name="Advanced">KaTeX math equations, Mermaid diagrams, Excalidraw drawings, multi-column layouts</Field>
              <Field name="Productivity">Slash commands (<code>/</code>), search &amp; replace, markdown paste support, undo/redo</Field>
              <Field name="Import/Export">Import from Word (.docx), export to Word (.docx), export to PDF</Field>
            </div>

            <Note>Viewers can read wiki pages but cannot edit them. Editing requires <RoleBadge role="manager" /> or <RoleBadge role="admin" /> role.</Note>
          </Section>

          {/* ── AI Import ─────────────────────────────────────────────── */}
          <Section id="ai-import" title="AI Import">
            <p>
              The <strong>AI Import</strong> feature lets managers and admins upload an existing
              document and use an LLM to extract structured requirements from it, then bulk-import
              them into any module.
            </p>

            <H3>How It Works</H3>
            <Step n={1}>Click <strong>AI Import</strong> in the sidebar.</Step>
            <Step n={2}>Select the target <strong>project</strong> and <strong>module</strong>.</Step>
            <Step n={3}>Upload a <strong>.docx</strong> or <strong>.pdf</strong> file (up to 50 MB). The document is parsed and sent to the LLM automatically.</Step>
            <Step n={4}>The AI extracts requirements and presents them. Use the chat to refine, add, or remove requirements from the list.</Step>
            <Step n={5}>When satisfied, tell the AI to finalise (e.g. <em>"import these"</em>). A requirements table appears for review.</Step>
            <Step n={6}>Edit titles, descriptions, priorities, or statuses as needed in the table. Remove any unwanted rows.</Step>
            <Step n={7}>Click <strong>Import N requirements</strong> to bulk-insert them into the selected module.</Step>

            <H3>Supported File Formats</H3>
            <div style={{ marginBottom: 12 }}>
              <Field name=".docx">Word (Open XML) — full text extraction</Field>
              <Field name=".pdf">PDF — text extraction (scanned/image-only PDFs may return no text)</Field>
            </div>

            <Note>AI Import requires an OpenAI-compatible LLM to be configured on the server. If the AI features are unavailable, ask your administrator to set the <code>LLM_API_KEY</code> environment variable.</Note>
            <Tip>You can have a back-and-forth conversation with the AI to iteratively refine the extracted requirements before importing.</Tip>
          </Section>

          {/* ── Reports & Baselines ───────────────────────────────────── */}
          <Section id="reports" title="Reports & Baselines">
            <p>
              The <strong>Reports</strong> page contains three tabs: <em>Overview</em>,
              <em> Coverage</em>, and <em>Baselines</em>.
            </p>

            <H3>Overview Report</H3>
            <p>
              Shows a high-level summary of all requirements across the selected project:
              total count, breakdown by status, and breakdown by priority. Use the project
              selector at the top to switch between projects.
            </p>

            <H3>Coverage Report</H3>
            <p>
              Displays which requirements have at least one inbound or outbound traceability
              link (<em>covered</em>) versus those with no links at all (<em>uncovered</em>).
              A coverage percentage is shown to help assess the completeness of your
              traceability model.
            </p>

            <H3>Baselines</H3>
            <p>
              A <strong>baseline</strong> is a named snapshot of all requirements and
              traceability links in a project at a specific point in time. Baselines are
              useful for marking release milestones or audit checkpoints.
            </p>

            <H4>Creating a Baseline</H4>
            <Step n={1}>Select a project, then click <strong>+ Create Baseline</strong>.</Step>
            <Step n={2}>Enter a name (e.g. <em>v1.0 Release</em>) and optional description.</Step>
            <Step n={3}>Click <strong>Save Baseline</strong>. The snapshot is taken immediately.</Step>

            <H4>Viewing a Baseline</H4>
            <p>Click <strong>▼ Details</strong> on any baseline card to expand the full list of requirements captured in that snapshot.</p>

            <H4>Restoring a Baseline</H4>
            <p>
              Click <strong>↩ Restore</strong> to revert existing requirements to the values
              they had when the baseline was taken. Requirements added after the snapshot are
              not affected. This action requires <RoleBadge role="admin" /> or <RoleBadge role="manager" /> role.
            </p>

            <H4>Comparing Two Baselines</H4>
            <Step n={1}>With two or more baselines saved, a <strong>Compare Baselines</strong> panel appears above the list.</Step>
            <Step n={2}>Select <strong>Baseline A (before)</strong> and <strong>Baseline B (after)</strong>.</Step>
            <Step n={3}>Click <strong>⇄ Compare</strong>. The diff shows:<br />
              — <span style={{ color: '#16a34a', fontWeight: 600 }}>Added</span> requirements (in B but not A)<br />
              — <span style={{ color: '#dc2626', fontWeight: 600 }}>Removed</span> requirements (in A but not B)<br />
              — <span style={{ color: '#d97706', fontWeight: 600 }}>Changed</span> requirements (field-by-field old → new)<br />
              — Link additions and removals
            </Step>

            <Note>Restoring or deleting a baseline requires admin or manager permissions.</Note>
          </Section>

          {/* ── User Management ───────────────────────────────────────── */}
          <Section id="user-management" title="User Management">
            <p>
              The <strong>Users</strong> page is only accessible to <RoleBadge role="admin" /> accounts.
            </p>

            <H3>Creating a User</H3>
            <Step n={1}>Click <strong>Users</strong> in the sidebar.</Step>
            <Step n={2}>Click <strong>+ New User</strong>.</Step>
            <Step n={3}>Enter a username, email, password, and select a role.</Step>
            <Step n={4}>Click <strong>Create User</strong>. The account is created immediately and the user can log in with the supplied credentials.</Step>

            <H3>Changing a User's Role</H3>
            <p>
              In the Users table, use the role dropdown in each row to change a user's role.
              You cannot change your own role.
            </p>

            <H3>Resetting a User's Password</H3>
            <Step n={1}>Click <strong>Reset Password</strong> next to the target user.</Step>
            <Step n={2}>Enter and confirm the new password (minimum 6 characters).</Step>
            <Step n={3}>Click <strong>Reset Password</strong>. The user's password is updated immediately. The current password is not required.</Step>

            <H3>Deleting a User</H3>
            <p>
              Click <strong>Delete</strong> next to the user and confirm. You cannot delete
              your own account. Deleting a user does not remove their requirements or projects.
            </p>

            <Note>Only admins can access the Users page, create accounts, change roles, reset passwords, or delete users.</Note>
          </Section>

          {/* ── Your Account ──────────────────────────────────────────── */}
          <Section id="account" title="Your Account">
            <H3>Changing Your Password</H3>
            <Step n={1}>In the sidebar, click <strong>Change Password</strong> (below your username).</Step>
            <Step n={2}>Enter your <strong>Current Password</strong>.</Step>
            <Step n={3}>Enter and confirm your <strong>New Password</strong> (minimum 6 characters).</Step>
            <Step n={4}>Click <strong>Update Password</strong>. The change takes effect immediately — your active session remains valid.</Step>

            <H3>Signing Out</H3>
            <p>Click <strong>Sign out</strong> in the sidebar. You will be returned to the login page.</p>

            <Note>If you forget your password, ask an admin to reset it for you via the Users page.</Note>
          </Section>
        </div>
      </div>
    </Layout>
  );
}

// Small helper not exported — only used inside this file
function H4({ children }) {
  return <h4 style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{children}</h4>;
}

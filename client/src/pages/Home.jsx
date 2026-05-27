import React, { useState, useMemo } from 'react';

export default function Home() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('test-gen'); // 'test-gen' or 'bug-gen'

  // --- TAB 1: Test Case Generator States ---
  const [prompt, setPrompt] = useState('');
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedTestCaseForCode, setSelectedTestCaseForCode] = useState(null);
  const [automationFramework, setAutomationFramework] = useState('Playwright');

  // --- TAB 2: Standalone Bug Generator States ---
  const [bugSummary, setBugSummary] = useState('');
  const [bugSeverity, setBugSeverity] = useState('Major');
  const [bugReproduction, setBugReproduction] = useState('');
  const [loadingBug, setLoadingBug] = useState(false);
  const [standaloneBugReport, setStandaloneBugReport] = useState(null);

  // Shared Context Environment Context
  const [testingEnvironment, setTestingEnvironment] = useState('Chrome v124 / Windows 11 (Staging)');
  const [activeBugReport, setActiveBugReport] = useState(null); 
  const [generatingBugId, setGeneratingBugId] = useState(null);

  // --- Core Actions: Test Generation ---
  const handleGenerateTests = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt }),
      });

      const result = await response.json();
      if (result.success) {
        const enrichedCases = result.data.map(tc => ({
          ...tc,
          status: 'Untested',
          actualResult: ''
        }));
        setTestCases(enrichedCases);
        setSelectedTestCaseForCode(null);
      } else {
        alert(result.error || 'Something went wrong');
      }
    } catch (error) {
      console.error(error);
      alert('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  // --- Core Actions: Table-Row Bug Generation ---
  const triggerInlineBugReport = async (tc) => {
    if (!tc.actualResult.trim()) {
      alert("Please add details in 'Actual Test Run Notes' first so the AI understands why the test failed.");
      return;
    }

    setGeneratingBugId(tc.id);
    try {
      const response = await fetch('http://localhost:5000/api/generate-bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCase: tc,
          actualNotes: tc.actualResult,
          environment: testingEnvironment
        }),
      });

      const result = await response.json();
      if (result.success) {
        setActiveBugReport(result.data);
      } else {
        alert(result.error || 'Failed to generate bug report.');
      }
    } catch (err) {
      console.error(err);
      alert('Network timeout connecting to Bug engine service.');
    } finally {
      setGeneratingBugId(null);
    }
  };

  // --- Core Actions: Tab 2 Standalone Bug Compilation (Auto-generation focus) ---
  const handleGenerateStandaloneBug = async (e) => {
    e.preventDefault();
    if (!bugSummary.trim()) {
      alert('Please provide at least a short defect summary header.');
      return;
    }

    setLoadingBug(true);
    try {
      // Create a clean, structural wrapper payload for the backend.
      // We pass empty fields or let it know that steps are intended to be auto-built.
      const baselineMockTestCase = {
        id: Math.floor(Math.random() * 9000) + 1000,
        title: bugSummary,
        type: 'Ad-Hoc Exploratory Run',
        preconditions: '',
        steps: [], // Let the backend know no steps were provided manually
        expectedResult: ''
      };

      const response = await fetch('http://localhost:5000/api/generate-bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCase: baselineMockTestCase,
          actualNotes: bugReproduction, // Your loose notes / raw logs
          environment: testingEnvironment
        }),
      });

      const result = await response.json();
      if (result.success) {
        setStandaloneBugReport(result.data);
      } else {
        alert(result.error || 'Failed to compile isolated report file.');
      }
    } catch (error) {
      console.error(error);
      alert('Could not reach backend validation engine.');
    } finally {
      setLoadingBug(false);
    }
  };

  // --- Table Matrix Logic Operations ---
  const updateStatus = (id, newStatus) => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, status: newStatus } : tc));
  };

  const handleActualResultChange = (id, value) => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, actualResult: value } : tc));
  };

  const toggleAllFilteredStatus = () => {
    const filteredIds = filteredTestCases.map(tc => tc.id);
    const hasExecutedTests = filteredTestCases.some(tc => tc.status !== 'Untested');

    setTestCases(prev => prev.map(tc => {
      if (filteredIds.includes(tc.id)) {
        return hasExecutedTests ? { ...tc, status: 'Untested', actualResult: '' } : { ...tc, status: 'Passed' };
      }
      return tc;
    }));
  };

  const metrics = useMemo(() => {
    const total = testCases.length;
    if (total === 0) return { total: 0, passed: 0, failed: 0, blocked: 0, untested: 0, completion: 0 };
    const passed = testCases.filter(tc => tc.status === 'Passed').length;
    const failed = testCases.filter(tc => tc.status === 'Failed').length;
    const blocked = testCases.filter(tc => tc.status === 'Blocked').length;
    const untested = testCases.filter(tc => tc.status === 'Untested').length;
    const completion = Math.round(((passed + failed + blocked) / total) * 100);
    return { total, passed, failed, blocked, untested, completion };
  }, [testCases]);

  const filteredTestCases = useMemo(() => {
    return testCases.filter(tc => {
      const matchesSearch = tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.expectedResult.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'All' || tc.type === typeFilter;
      const matchesStatus = statusFilter === 'All' || tc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [testCases, searchQuery, typeFilter, statusFilter]);

  const generatedCodeSnippet = useMemo(() => {
    if (!selectedTestCaseForCode) return '';
    const tc = selectedTestCaseForCode;
    const cleanTitle = tc.title.replace(/'/g, "\\'");

    if (automationFramework === 'Playwright') {
      return `test('${cleanTitle}', async ({ page }) => {\n  // Precondition: ${tc.preconditions || 'None'}\n${tc.steps?.map(s => `  // Step: ${s}\n  await page.locator('//your-selector').click();`).join('\n')}\n  \n  // Expected: ${tc.expectedResult}\n  await expect(page.locator('body')).toBeVisible(); \n});`;
    } else {
      return `describe('QA Automation Suite', () => {\n  it('${cleanTitle}', () => {\n    // Precondition: ${tc.preconditions || 'None'}\n${tc.steps?.map(s => `    // Step: ${s}`).join('\n')}\n    \n    // Expected: ${tc.expectedResult}\n    cy.get('.main-container').should('exist');\n  });\n});`;
    }
  }, [selectedTestCaseForCode, automationFramework]);

  const exportToCSV = () => {
    if (testCases.length === 0) return;
    const headers = ['ID', 'Type', 'Title', 'Preconditions', 'Expected Result', 'Status', 'Actual Result'];
    const rows = testCases.map(tc => [
      tc.id, tc.type, `"${tc.title.replace(/"/g, '""')}"`,
      `"${(tc.preconditions || '').replace(/"/g, '""')}"`,
      `"${tc.expectedResult.replace(/"/g, '""')}"`, tc.status, `"${tc.actualResult.replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "qa_matrix_execution_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto font-sans text-slate-800 bg-slate-50 min-h-screen relative">
      
      {/* Workspace Base Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm mb-6 gap-4">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900">⚡ Professional QA Studio</h1>
          <p className="text-slate-500 mt-1 text-sm">Analyze structural requirements profiles, design verification paths, and automate engineering-ready defect tickets.</p>
        </div>
        <div className="flex flex-col w-full md:w-auto">
          <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Scope Target Environment Context</span>
          <input 
            type="text" 
            value={testingEnvironment} 
            onChange={(e) => setTestingEnvironment(e.target.value)}
            className="py-1.5 px-3 rounded border border-slate-300 text-xs w-64 focus:outline-none focus:border-indigo-500 bg-slate-50 font-medium"
            placeholder="e.g., Staging Preview v1.4"
          />
        </div>
      </div>

      {/* 🧭 Tab Switcher Bar */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button 
          onClick={() => setActiveTab('test-gen')}
          className={`py-3 px-5 border-b-2 font-bold text-sm cursor-pointer transition-all ${
            activeTab === 'test-gen' 
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40' 
              : 'border-transparent text-slate-500 hover:text-slate-800 bg-transparent'
          }`}
        >
          📋 Test Case Matrix Generator
        </button>
        <button 
          onClick={() => setActiveTab('bug-gen')}
          className={`py-3 px-5 border-b-2 font-bold text-sm cursor-pointer transition-all ${
            activeTab === 'bug-gen' 
              ? 'border-red-600 text-red-600 bg-red-50/40' 
              : 'border-transparent text-slate-500 hover:text-slate-800 bg-transparent'
          }`}
        >
          ⚠️ Standalone Bug Report Studio
        </button>
      </div>

      {/* --- WORKSPACE ROUTING PANEL CONFIGURATIONS --- */}

      {/* 📋 VIEW TAB 1: TEST GENERATOR STUDIO */}
      {activeTab === 'test-gen' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <form onSubmit={handleGenerateTests}>
              <label className="font-bold text-sm uppercase tracking-wider text-slate-500 block mb-2">Requirement Specifications & Target Acceptance Criteria</label>
              <textarea
                rows="4"
                className="w-full p-3 rounded-md text-sm border border-slate-300 box-border font-inherit focus:outline-none focus:border-indigo-500"
                placeholder="Paste raw feature descriptions or user story statements here to generate complete matrix plans..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button type="submit" disabled={loading} className="py-2.5 px-5 mt-3 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-md font-bold text-sm disabled:opacity-50 transition-colors">
                {loading ? 'Compiling AI Matrix Arrays...' : '✨ Parse Requirements & Scaffold Matrix'}
              </button>
            </form>
          </div>

          {metrics.total > 0 && (
            <>
              {/* Table Metric Dashboard Blocks */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-lg border-l-4 border-slate-500 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Total Matrix Runs</div>
                  <div className="text-xl font-extrabold mt-0.5 text-slate-900">{metrics.total}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-emerald-500 shadow-xs">
                  <div className="text-[11px] font-bold text-emerald-600 uppercase">Passed</div>
                  <div className="text-xl font-extrabold mt-0.5 text-emerald-600">{metrics.passed}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-red-500 shadow-xs">
                  <div className="text-[11px] font-bold text-red-500 uppercase">Failed</div>
                  <div className="text-xl font-extrabold mt-0.5 text-red-500">{metrics.failed}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-amber-500 shadow-xs">
                  <div className="text-[11px] font-bold text-amber-500 uppercase">Blocked</div>
                  <div className="text-xl font-extrabold mt-0.5 text-amber-500">{metrics.blocked}</div>
                </div>
                <button onClick={exportToCSV} className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded border-none cursor-pointer flex items-center justify-center gap-1 shadow-xs h-full py-3">
                  📥 Export CSV Data
                </button>
              </div>

              {/* Progress Gauge */}
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span>RUN COMPLETION LOG GAUGING PROGRESS</span>
                  <span>{metrics.completion}% COMPLETE</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${metrics.completion}%` }} />
                </div>
              </div>

              {/* Filtering Controls */}
              <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 flex-1">
                  <input type="text" placeholder="🔍 Search description keywords..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="py-1.5 px-3 rounded-md border border-slate-300 text-sm focus:outline-none w-64" />
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="p-1.5 rounded border border-slate-300 text-sm bg-white">
                    <option value="All">All Framework Types</option>
                    <option value="Positive">Positive Paths</option>
                    <option value="Negative">Negative Paths</option>
                    <option value="Boundary">Boundary Values</option>
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-1.5 rounded border border-slate-300 text-sm bg-white">
                    <option value="All">All Status Options</option>
                    <option value="Untested">Untested</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                <button onClick={toggleAllFilteredStatus} className="py-1.5 px-3 border rounded text-xs font-bold bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100">
                  {filteredTestCases.some(tc => tc.status !== 'Untested') ? '⟲ Clear Filters' : '✓ Bulk Pass Filtered'}
                </button>
              </div>

              {/* Dynamic Columns Configuration */}
              <div className={`grid gap-6 items-start ${selectedTestCaseForCode ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
                <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${selectedTestCaseForCode ? 'lg:col-span-2' : ''}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                          <th className="p-3 w-12">ID</th>
                          <th className="p-3 w-80">Test Setup Criteria Log Matrix</th>
                          <th className="p-3 w-48">Expected Logic Verification Target</th>
                          <th className="p-3 w-24 text-center">Status</th>
                          <th className="p-3 w-48">Execution Run / Deviation Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTestCases.map((tc) => (
                          <tr key={tc.id} className={`align-top ${selectedTestCaseForCode?.id === tc.id ? 'bg-indigo-50/50' : tc.status === 'Failed' ? 'bg-red-50/30' : ''}`}>
                            <td className="p-3 font-bold text-slate-400">{tc.id}</td>
                            <td className="p-3">
                              <div className="flex gap-2 items-center mb-1">
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase bg-slate-200 text-slate-700">{tc.type}</span>
                                <button onClick={() => setSelectedTestCaseForCode(tc)} className="text-indigo-600 hover:text-indigo-800 text-xs p-0 border-none bg-transparent cursor-pointer underline">Code Hook</button>
                              </div>
                              <div className="font-bold text-slate-900 text-[13px]">{tc.title}</div>
                              <div className="text-[11px] text-slate-500 mt-1"><strong>Pre:</strong> {tc.preconditions}</div>
                              <ol className="mt-2 pl-4 text-xs text-slate-600 list-decimal space-y-0.5">
                                {tc.steps?.map((s, i) => <li key={i}>{s}</li>)}
                              </ol>
                            </td>
                            <td className="p-3 text-xs text-slate-600">{tc.expectedResult}</td>
                            <td className="p-3 text-center">
                              <select value={tc.status} onChange={(e) => updateStatus(tc.id, e.target.value)} className={`p-1 rounded text-xs font-bold text-white border-none w-20 ${tc.status === 'Passed' ? 'bg-emerald-500' : tc.status === 'Failed' ? 'bg-red-500' : 'bg-slate-400'}`}>
                                <option value="Untested">Untested</option>
                                <option value="Passed">PASS</option>
                                <option value="Failed">FAIL</option>
                              </select>
                              {tc.status === 'Failed' && (
                                <button onClick={() => triggerInlineBugReport(tc)} disabled={generatingBugId !== null} className="mt-1.5 w-20 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 py-1 rounded cursor-pointer font-bold">
                                  {generatingBugId === tc.id ? 'Drafting...' : '⚠️ Bug Report'}
                                </button>
                              )}
                            </td>
                            <td className="p-3">
                              <textarea rows="2" placeholder="Add fail signatures or exception parameters logs here..." value={tc.actualResult} onChange={(e) => handleActualResultChange(tc.id, e.target.value)} className="w-full p-1 rounded border border-slate-300 text-xs focus:outline-none" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Automation Side-pane Panel Drawer */}
                {selectedTestCaseForCode && (
                  <div className="bg-slate-900 text-slate-100 p-5 rounded-xl shadow-lg sticky top-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[11px] font-extrabold text-sky-400 tracking-wider">CODE SCAFFOLDER</span>
                      <button onClick={() => setSelectedTestCaseForCode(null)} className="bg-transparent border-none text-slate-400 text-xl cursor-pointer">×</button>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <button onClick={() => setAutomationFramework('Playwright')} className={`flex-1 py-1 text-xs font-bold rounded border-none ${automationFramework === 'Playwright' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Playwright</button>
                      <button onClick={() => setAutomationFramework('Cypress')} className={`flex-1 py-1 text-xs font-bold rounded border-none ${automationFramework === 'Cypress' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Cypress</button>
                    </div>
                    <pre className="p-3 bg-slate-800 rounded text-xs font-mono whitespace-pre-wrap break-all text-slate-300">{generatedCodeSnippet}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ⚠️ VIEW TAB 2: STANDALONE BUG GENERATOR STUDIO (JIRA THEMED) */}
      {activeTab === 'bug-gen' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
          
          {/* Ad-Hoc Input Workspace Entry Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm xl:col-span-2">
            <h3 className="m-0 text-base font-bold text-slate-900 mb-1">Ad-Hoc Defect Transformer</h3>
            <p className="text-slate-500 text-xs mb-4">Draft standalone reports from exploratory discoveries. Gemini will automatically deduce standard structural execution paths.</p>
            
            <form onSubmit={handleGenerateStandaloneBug} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Defect Title Summary / Quick Action</label>
                <input 
                  type="text"
                  value={bugSummary}
                  onChange={(e) => setBugSummary(e.target.value)}
                  placeholder="e.g., Search button unclickable after applying sorting filters"
                  className="w-full p-2.5 rounded border border-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Business Criticality Status Severity</label>
                <select 
                  value={bugSeverity} 
                  onChange={(e) => setBugSeverity(e.target.value)}
                  className="w-full p-2.5 rounded border border-slate-300 text-sm bg-white focus:outline-none"
                >
                  <option value="Critical">Critical (Blocker, System Crash, Payment Failure)</option>
                  <option value="Major">Major (Core Flow Break, Faulty UI Redirection, API Failure)</option>
                  <option value="Minor">Minor (Typo, Disaligned Button Layout, Visual Asset Anomaly)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Loose Observation Notes, Context, or Log Snippets (Optional)</label>
                <textarea 
                  rows="5"
                  value={bugReproduction}
                  onChange={(e) => setBugReproduction(e.target.value)}
                  placeholder="Paste rough notes, what you observed, or console exceptions here..."
                  className="w-full p-2.5 rounded border border-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button 
                type="submit" 
                disabled={loadingBug}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded text-sm cursor-pointer transition-colors disabled:opacity-50"
              >
                {loadingBug ? 'Synthesizing Steps via Gemini...' : '⚠️ Synthesize Professional Defect Asset'}
              </button>
            </form>
          </div>

          {/* 🎫 INTERACTIVE BOARD TICKET DISPLAY CARD */}
          <div className="xl:col-span-3">
            {standaloneBugReport ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                
                {/* Jira Card Header Actions Toolbar */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-3 h-3 bg-red-500 rounded-sm"></span>
                    <span className="font-semibold text-slate-500 tracking-wider font-mono">QA-BUG-{Math.floor(Math.random() * 800) + 100}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-500 font-medium">Defect Log Tracking Instance</span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(standaloneBugReport.markdownReport);
                      alert("Copied complete markdown description block straight to your clipboard!");
                    }}
                    className="bg-white hover:bg-slate-50 border border-slate-300 py-1.5 px-3 rounded text-xs font-bold text-slate-700 cursor-pointer transition-colors shadow-2xs"
                  >
                    📋 Copy Description Markdown
                  </button>
                </div>

                {/* Main Interactive Jira Issue Ticket Content Body */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Descriptive Sections (2/3 width) */}
                  <div className="lg:col-span-2 space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 leading-snug m-0">{standaloneBugReport.bugTitle || bugSummary}</h2>
                    </div>

                    <div className="flex gap-2">
                      <span className="bg-sky-100 text-sky-800 text-[11px] font-bold py-1 px-2.5 rounded-full flex items-center gap-1">
                        🔒 Open Status
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-[11px] font-bold py-1 px-2.5 rounded-full">
                        ✨ Gemini Generated Steps
                      </span>
                    </div>

                    {/* Description Block Display */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</h4>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-mono text-xs text-slate-700 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-wrap shadow-inner">
                        {standaloneBugReport.markdownReport}
                      </div>
                    </div>
                  </div>

                  {/* Right Metadata Field Sidebar Panel (1/3 width) */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 space-y-4 text-xs">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5 m-0">Details</h4>
                    
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                      <div className="text-slate-500 font-medium">Issue Type:</div>
                      <div className="font-bold text-red-600 flex items-center gap-1">🛑 Bug / Defect</div>
                      
                      <div className="text-slate-500 font-medium">Priority Severity:</div>
                      <div>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] text-white ${
                          bugSeverity === 'Critical' ? 'bg-red-600' :
                          bugSeverity === 'Major' ? 'bg-orange-500' : 'bg-blue-500'
                        }`}>
                          {bugSeverity}
                        </span>
                      </div>
                      
                      <div className="text-slate-500 font-medium">Environment Context:</div>
                      <div className="text-slate-800 font-semibold break-words">{testingEnvironment}</div>

                      <div className="text-slate-500 font-medium">Assignee:</div>
                      <div className="text-slate-600 italic">Core Engineering Team</div>

                      <div className="text-slate-500 font-medium">Reporter:</div>
                      <div className="font-semibold text-slate-800">QA AI Co-Pilot Studio</div>

                      <div className="text-slate-500 font-medium">Resolution:</div>
                      <div className="text-slate-400 italic">Unresolved (New)</div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-400 leading-normal">
                      This structure is prepared to be mapped directly into Jira via webhook links or manual copy-paste transfers.
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-xl p-8 text-slate-500 italic text-center pt-32 min-h-[480px] border border-slate-800 text-xs">
                No active card loaded. Complete the ad-hoc form requirements parameters and observations logs on the left to review your Jira Ticket artifact representation render panel stream.
              </div>
            )}
          </div>

        </div>
      )}

      {/* --- INLINE INTERACTIVE OVERLAY MODAL (From Tab 1 Failed Rows) --- */}
      {activeBugReport && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide bg-red-600 text-white uppercase">{activeBugReport.severity} Severity Case</span>
                <h3 className="text-sm font-bold mt-1 text-slate-200">{activeBugReport.bugTitle}</h3>
              </div>
              <button onClick={() => setActiveBugReport(null)} className="text-slate-400 hover:text-white bg-transparent border-none text-2xl cursor-pointer">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto bg-slate-50 flex-1 font-mono text-xs text-slate-700">
              <div className="bg-white border p-4 rounded shadow-inner whitespace-pre-wrap">{activeBugReport.markdownReport}</div>
            </div>
            <div className="p-3 border-t border-slate-200 bg-white flex justify-end gap-2">
              <button onClick={() => { navigator.clipboard.writeText(activeBugReport.markdownReport); alert("Copied output successfully!"); }} className="bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded cursor-pointer border-none">📋 Copy Markdown</button>
              <button onClick={() => setActiveBugReport(null)} className="bg-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded cursor-pointer border-none">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
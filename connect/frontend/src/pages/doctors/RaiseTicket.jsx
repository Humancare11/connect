import React, { useState, useEffect } from 'react';
import './RaiseTicket.css';
import api from '../../api';

const STATUS_META = {
  open:       { label: 'Open',       cls: 'rt-s-open'     },
  pending:    { label: 'Pending',    cls: 'rt-s-pending'  },
  resolved:   { label: 'Resolved',   cls: 'rt-s-resolved' },
  closed:     { label: 'Closed',     cls: 'rt-s-closed'   },
};

const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const RaiseTicket = () => {
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState(null); // { msg, ok }
  const [tickets, setTickets]       = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [expanded, setExpanded]     = useState(null);
  const [filter, setFilter]         = useState('all');

  useEffect(() => { fetchTickets(); }, []);

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTickets = async () => {
    try {
      const res = await api.get('/api/tickets/my');
      setTickets(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/tickets/create', { title, description });
      showToast('Ticket created successfully!', true);
      setTitle('');
      setDescription('');
      fetchTickets();
    } catch (err) {
      showToast(err.response?.data?.message || 'An error occurred. Please try again.', false);
    } finally {
      setLoading(false);
    }
  };

  const TABS = ['all', 'open', 'pending', 'resolved', 'closed'];
  const counts = TABS.reduce((a, t) => {
    a[t] = t === 'all' ? tickets.length : tickets.filter(x => x.status === t).length;
    return a;
  }, {});
  const displayed = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  return (
    <div className="rt-root">

      {/* ── Toast ── */}
      {toast && (
        <div className={`rt-toast ${toast.ok ? 'rt-toast--ok' : 'rt-toast--err'}`}>
          <span>{toast.ok ? '✓' : '!'}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="rt-page-head">
        <div>
          <span className="rt-eyebrow">Support</span>
          <h1 className="rt-page-title">Help & Tickets</h1>
          <p className="rt-page-sub">Submit an issue or track your existing support requests.</p>
        </div>
        <div className="rt-head-stat">
          <span className="rt-stat-num">{tickets.length}</span>
          <span className="rt-stat-label">Total tickets</span>
        </div>
      </div>

      <div className="rt-layout">

        {/* ── Left: Create Ticket ── */}
        <div className="rt-form-panel">
          <div className="rt-panel-head">
            <div className="rt-panel-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="rt-panel-title">New Ticket</h2>
              <p className="rt-panel-sub">Describe your issue clearly for faster resolution.</p>
            </div>
          </div>

          <form className="rt-form" onSubmit={handleSubmit}>
            <div className="rt-field">
              <label className="rt-label">Title <span className="rt-req">*</span></label>
              <input
                className="rt-input"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Unable to access patient records"
                required
              />
            </div>

            <div className="rt-field">
              <label className="rt-label">Description <span className="rt-req">*</span></label>
              <textarea
                className="rt-input rt-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={5}
                placeholder="Please describe your issue in detail — steps to reproduce, expected vs actual behavior, etc."
                required
              />
              <p className="rt-hint">{description.length}/500 characters</p>
            </div>

            <button className="rt-submit-btn" type="submit" disabled={loading}>
              {loading
                ? <><span className="rt-spin" /> Submitting…</>
                : <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Submit Ticket
                  </>
              }
            </button>
          </form>

          {/* Tips */}
          <div className="rt-tips">
            <p className="rt-tips-title">💡 Tips for faster support</p>
            <ul>
              <li>Include error messages if any</li>
              <li>Mention the page or feature affected</li>
              <li>Describe steps that led to the issue</li>
            </ul>
          </div>
        </div>

        {/* ── Right: Ticket List ── */}
        <div className="rt-list-panel">
          <div className="rt-list-head">
            <h2 className="rt-panel-title">Your Tickets</h2>
            <div className="rt-tabs">
              {TABS.map(t => (
                <button
                  key={t}
                  className={`rt-tab ${filter === t ? 'rt-tab--active' : ''}`}
                  onClick={() => setFilter(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  <span className="rt-tab-count">{counts[t]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rt-tickets">
            {fetching ? (
              <div className="rt-skeletons">
                {[1,2,3].map(i => <div key={i} className="rt-skeleton" style={{ animationDelay: `${i*0.1}s` }}/>)}
              </div>
            ) : displayed.length === 0 ? (
              <div className="rt-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>{filter === 'all' ? 'No tickets yet. Submit one above!' : `No ${filter} tickets.`}</p>
              </div>
            ) : (
              displayed.map((ticket, i) => {
                const sm = STATUS_META[ticket.status] || { label: ticket.status, cls: 'rt-s-open' };
                const isOpen = expanded === ticket._id;
                return (
                  <div
                    key={ticket._id}
                    className={`rt-ticket ${isOpen ? 'rt-ticket--open' : ''}`}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <div className="rt-ticket-top" onClick={() => setExpanded(isOpen ? null : ticket._id)}>
                      <div className="rt-ticket-left">
                        <div className="rt-ticket-id">#{String(i + 1).padStart(3, '0')}</div>
                        <div className="rt-ticket-info">
                          <span className="rt-ticket-title">{ticket.title}</span>
                          <span className="rt-ticket-date">{fmt(ticket.createdAt)}</span>
                        </div>
                      </div>
                      <div className="rt-ticket-right">
                        <span className={`rt-badge ${sm.cls}`}>{sm.label}</span>
                        <svg
                          className="rt-chevron"
                          width="14" height="14"
                          viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="rt-ticket-body">
                        <div className="rt-ticket-desc">
                          <p className="rt-body-label">Description</p>
                          <p className="rt-body-text">{ticket.description}</p>
                        </div>
                        {ticket.status === 'resolved' && ticket.resolution && (
                          <div className="rt-resolution">
                            <div className="rt-resolution-head">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                              </svg>
                              Resolution
                            </div>
                            <p>{ticket.resolution}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaiseTicket;
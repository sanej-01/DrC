'use client';

/**
 * AlertTray — Phase 6.4
 * Manager alert dropdown showing active/snoozed alerts
 * Snooze (24h default) or dismiss alerts
 */

import { useEffect, useRef, useState } from 'react';

interface Alert {
  id: string;
  alert_type: 'score_drop' | 'new_feedback' | 'dispute_filed';
  title: string;
  description?: string;
  status: 'active' | 'snoozed' | 'dismissed';
  created_at: string;
  developer?: {
    display_name: string;
    github_handle?: string;
  };
}

interface AlertTrayProps {
  workspaceId: string;
}

function getAlertConfig(alertType: string) {
  switch (alertType) {
    case 'score_drop':
      return {
        icon: '📉',
        color: 'bg-red-100 border-red-300',
        badgeColor: 'bg-red-500',
      };
    case 'new_feedback':
      return {
        icon: '💬',
        color: 'bg-blue-100 border-blue-300',
        badgeColor: 'bg-blue-500',
      };
    case 'dispute_filed':
      return {
        icon: '⚠️',
        color: 'bg-amber-100 border-amber-300',
        badgeColor: 'bg-amber-500',
      };
    default:
      return {
        icon: '🔔',
        color: 'bg-gray-100 border-gray-300',
        badgeColor: 'bg-gray-500',
      };
  }
}

export default function AlertTray({ workspaceId }: AlertTrayProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  // Fetch alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(`/api/manager/alerts?workspace_id=${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          setAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
      }
    };

    fetchAlerts();
    // Poll every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  // Close tray on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSnooze = async (alertId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/manager/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'snooze',
          alert_id: alertId,
          minutes: 1440, // 24 hours
        }),
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to snooze alert:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/manager/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dismiss',
          alert_id: alertId,
        }),
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <div ref={trayRef} className="relative">
      {/* Alert bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:text-gray-900 transition-colors"
        aria-label="Alerts"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {activeCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Alerts</h3>
            <p className="text-xs text-gray-600">
              {activeCount} active {activeCount === 1 ? 'alert' : 'alerts'}
            </p>
          </div>

          {alerts.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {alerts.map((alert) => {
                const config = getAlertConfig(alert.alert_type);
                return (
                  <div
                    key={alert.id}
                    className={`p-3 border-b border-gray-100 last:border-b-0 ${config.color} transition-all`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{config.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {alert.title}
                        </p>
                        {alert.description && (
                          <p className="text-xs text-gray-700 mt-1">
                            {alert.description}
                          </p>
                        )}
                        {alert.developer && (
                          <p className="text-xs text-gray-600 mt-1">
                            {alert.developer.display_name}
                            {alert.developer.github_handle &&
                              ` (@${alert.developer.github_handle})`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSnooze(alert.id)}
                        disabled={loading}
                        className="flex-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Snooze 24h
                      </button>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        disabled={loading}
                        className="flex-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-600">No active alerts</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

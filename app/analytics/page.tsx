'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LucideIcon, TrendingUp, Users, Activity, PieChart } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AnalyticsDataPoint {
  name: string;
  activeUsers: number;
  heatAlerts: number;
  riskScore: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate fetching data
    const fetchData = async () => {
      try {
        // In a real app, you would fetch from an API
        // For now, we'll use mock data
        const mockData = [
          { name: 'Jan', activeUsers: 4000, heatAlerts: 2400, riskScore: 80 },
          { name: 'Feb', activeUsers: 3000, heatAlerts: 1398, riskScore: 65 },
          { name: 'Mar', activeUsers: 2000, heatAlerts: 9800, riskScore: 72 },
          { name: 'Apr', activeUsers: 2780, heatAlerts: 3908, riskScore: 56 },
          { name: 'May', activeUsers: 1890, heatAlerts: 4800, riskScore: 55 },
          { name: 'Jun', activeUsers: 2390, heatAlerts: 3800, riskScore: 61 },
          { name: 'Jul', activeUsers: 3490, heatAlerts: 4300, riskScore: 78 },
        ];
        setData(mockData);
        setLoading(false);
      } catch (err) {
        setError('Failed to load analytics data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>
        <div className="animate-pulse flex space-x-4">
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
          <div className="h-8 w-64 bg-gray-200 rounded"></div>
          <div className="h-8 w-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-indigo-500 p-3 rounded bg-indigo-50">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{data[0]?.activeUsers?.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-red-500 p-3 rounded bg-red-50">
              <Activity className="h-5 w-5" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Heat Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{data[0]?.heatAlerts?.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-yellow-500 p-3 rounded bg-yellow-50">
              <Users className="h-5 w-5" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Communities</p>
              <p className="text-2xl font-bold text-gray-900">128</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-green-500 p-3 rounded bg-green-50">
              <PieChart className="h-5 w-5" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Average Risk Score</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(data.reduce((sum, d) => sum + d.riskScore, 0) / data.length)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Monthly Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="activeUsers" name="Active Users" barSize="20" fill="#4f46e5" />
            <Bar dataKey="heatAlerts" name="Heat Alerts" barSize="20" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
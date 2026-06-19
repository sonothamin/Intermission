import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from "recharts";
import { analyticsApi, Analytics, libraryApi, LibraryItem } from "../lib/api";
import { mediaPath } from "../lib/media";
import { Clock, Film, Tv, Activity, Trophy, Library } from "lucide-react";
import { CustomSelect } from "../components/CustomSelect";
import {
  chartAxisStroke,
  chartCursorFill,
  chartGridStroke,
  chartTooltipItemStyle,
  chartTooltipStyle,
} from "../lib/chartTheme";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1"];

const getFlagEmoji = (countryCode: string) => {
  if (!countryCode || countryCode.length !== 2) return countryCode;
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

type Period = "all" | "30d" | "90d" | "1y";

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [recent, setRecent] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, recentRes] = await Promise.all([
        analyticsApi.get({ period }),
        libraryApi.list({ sort_by: "updated_at", sort_dir: "desc", limit: 5 }),
      ]);
      setData(analyticsRes);
      setRecent(recentRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchData]);

  if (loading && !data) {
    return <div className="text-theme-secondary flex items-center justify-center h-64">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="text-red-400">Failed to load analytics.</div>;
  }

  const { summary, genres, rating_distribution, monthly_activity } = data;

  const countriesWithFlags = data.countries?.map(c => ({
    ...c,
    code: `${getFlagEmoji(c.code)} ${c.code}`
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Hello, {profile?.display_name || user?.email?.split("@")[0] || "User"}!
        </h1>
        <div className="flex gap-2">
          <CustomSelect
            value={period}
            onChange={(val) => setPeriod(val as Period)}
            className="bg-theme-secondary border border-theme text-sm rounded"
            buttonClassName="px-3 py-1.5"
            align="right"
            options={[
              { value: "all", label: "All Time" },
              { value: "30d", label: "Last 30 Days" },
              { value: "90d", label: "Last 90 Days" },
              { value: "1y", label: "This Year" }
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dense-card flex items-center gap-4">
          <div className="p-3 bg-[#10b981]/10 rounded-lg text-[#10b981]">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-secondary">Total Watch Time</p>
            <h3 className="text-2xl font-bold">
              {summary.total_hours_watched.toFixed(1)}{" "}
              <span className="text-sm font-normal text-theme-secondary">hrs</span>
            </h3>
            <p className="text-xs text-theme-muted mt-0.5">
              {summary.movie_hours.toFixed(1)}h movies · {summary.tv_hours.toFixed(1)}h TV
            </p>
          </div>
        </div>

        <div className="dense-card flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-secondary">Movies Watched</p>
            <h3 className="text-2xl font-bold">{summary.movies_watched}</h3>
            <p className="text-xs text-theme-muted mt-0.5">
              {summary.total_movies} in library
            </p>
          </div>
        </div>

        <div className="dense-card flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-secondary">Episodes Watched</p>
            <h3 className="text-2xl font-bold">{summary.episodes_watched}</h3>
            <p className="text-xs text-theme-muted mt-0.5">
              {summary.series_tracked} series tracked
            </p>
          </div>
        </div>

        <div className="dense-card flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-secondary">Library Total</p>
            <h3 className="text-2xl font-bold">{summary.total_items}</h3>
            <p className="text-xs text-theme-muted mt-0.5">
              {summary.watchlist_count} on watchlist
            </p>
          </div>
        </div>
      </div>

      {/* Middle Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="dense-card lg:col-span-2 flex flex-col h-80">
          <h3 className="text-sm font-semibold text-theme-primary mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#10b981]" />
            Watch Habits
          </h3>
          <div className="flex-1 min-h-0">
            {monthly_activity?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly_activity} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                  <XAxis dataKey="month" stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Line type="monotone" dataKey="movies" name="Movies" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="episodes" name="Episodes" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">Mark items completed or log episodes to see activity.</div>
            )}
          </div>
        </div>

        <div className="dense-card flex flex-col h-80">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">Top Genres</h3>
          <div className="flex-1 min-h-0 relative">
            {genres?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genres.slice(0, 5)}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="name"
                    stroke="none"
                  >
                    {genres.slice(0, 5).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">No genre data yet.</div>
            )}
            {genres?.length > 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-xs text-theme-secondary block mb-0.5">Top</span>
                <span className="font-bold text-sm text-theme-primary block truncate w-20">{genres[0].name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Language Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Language Pie Chart */}
        <div className="dense-card flex flex-col h-80">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">Top Languages (by count)</h3>
          <div className="flex-1 min-h-0 relative">
            {data?.languages?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.languages.slice(0, 5)}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="code"
                    stroke="none"
                  >
                    {data.languages.slice(0, 5).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">No language data yet.</div>
            )}
            {data?.languages?.length > 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-xs text-theme-secondary block mb-0.5">Top</span>
                <span className="font-bold text-sm text-theme-primary block truncate w-20">{data.languages[0].code.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Minutes per Language Bar Chart */}
        <div className="dense-card flex flex-col h-80">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">Minutes Watched by Language</h3>
          <div className="flex-1 min-h-0">
            {data?.languages?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.languages} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis type="number" stroke={chartAxisStroke} />
                  <YAxis dataKey="code" type="category" stroke={chartAxisStroke} width={80} />
                  <Tooltip contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle} />
                  <Bar dataKey="minutes" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">No minute data yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Country Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Country Pie Chart */}
        <div className="dense-card flex flex-col h-80">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">Top Regions (by count)</h3>
          <div className="flex-1 min-h-0 relative">
            {countriesWithFlags.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={countriesWithFlags.slice(0, 5)} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="code" stroke="none">
                    {countriesWithFlags.slice(0, 5).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle}
                           itemStyle={chartTooltipItemStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">No region data yet.</div>
            )}
            {countriesWithFlags.length > 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-xs text-theme-secondary block mb-0.5">Top</span>
                <span className="font-bold text-sm text-theme-primary block truncate w-24">
                  {countriesWithFlags[0].code}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Minutes per Region Bar Chart */}
        <div className="dense-card flex flex-col h-80">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">Minutes Watched by Region</h3>
          <div className="flex-1 min-h-0">
            {countriesWithFlags.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countriesWithFlags} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis type="number" stroke={chartAxisStroke} />
                  <YAxis dataKey="code" type="category" stroke={chartAxisStroke} width={80} />
                  <Tooltip contentStyle={chartTooltipStyle}
                           itemStyle={chartTooltipItemStyle} />
                  <Bar dataKey="minutes" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">No minute data yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="dense-card flex flex-col h-64">
          <h3 className="text-sm font-semibold text-theme-primary mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Rating Distribution
            {summary.avg_rating !== null && (
              <span className="text-xs font-normal text-theme-muted ml-auto">
                Avg {summary.avg_rating.toFixed(1)}/10
              </span>
            )}
          </h3>
          <div className="flex-1 min-h-0">
            {rating_distribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rating_distribution} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                  <XAxis dataKey="score" stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: chartCursorFill }}
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar dataKey="count" name="Items" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">No ratings yet.</div>
            )}
          </div>
        </div>

        <div className="dense-card flex flex-col h-64">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-theme-primary">Recent Activity</h3>
            <Link to="/library" className="text-xs font-medium text-[#10b981] hover:underline">View All</Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-3">
            {recent.length > 0 ? recent.map(item => (
              <Link
                key={item.id}
                to={mediaPath(item.media_type, item.tmdb_id)}
                className="flex gap-3 items-center p-2 rounded hover:bg-theme-tertiary transition-colors group"
              >
                <div className="w-10 h-14 bg-theme-tertiary rounded overflow-hidden flex-shrink-0">
                  {item.poster_url ? (
                    <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <Film className="w-4 h-4 m-auto mt-5 text-theme-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-theme-primary truncate group-hover:text-[#10b981] transition-colors">{item.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${item.media_type === 'movie' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                      {item.media_type}
                    </span>
                    <span className="text-xs text-theme-secondary truncate">
                      {item.status === 'watching' ? 'Currently watching' :
                        item.status === 'completed' ? `Completed · Rated ${item.rating || '-'}/10` :
                          item.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </Link>
            )) : (
              <div className="h-full flex items-center justify-center text-theme-muted text-sm">Your library is empty.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

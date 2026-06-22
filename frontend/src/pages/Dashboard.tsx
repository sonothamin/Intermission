import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, BarChart, Bar,
} from "recharts";
import { analyticsApi, Analytics, libraryApi, LibraryItem } from "../lib/api";
import { mediaPath } from "../lib/media";
import { Clock, Film, Tv, Activity, Trophy, Library } from "lucide-react";
import { CustomSelect } from "../components/CustomSelect";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { ChartTooltip } from "../components/ChartTooltip";
import { DonutChart } from "../components/DonutChart";
import { EmptyChartState } from "../components/EmptyChartState";
import { HorizontalBarChart } from "../components/HorizontalBarChart";
import { ContinueWatching } from "../components/ContinueWatching";
import { chartAxisStroke, chartGridStroke } from "../lib/chartTheme";

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

  // Convert decimal hours into a compact days / hours / minutes breakdown.
  const totalMinutes = Math.round(summary.total_hours_watched * 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const watchParts: Array<[number, string]> = [
    [days, "d"],
    [hours, "h"],
    [minutes, "m"],
  ];
  // Keep the two largest non-zero units so the headline stays short
  // (e.g. "1d 4h" or "23h 15m"); fall back to the first unit if everything is zero.
  const nonZero = watchParts.filter(([n]) => n > 0);
  const headlineParts = (nonZero.length >= 2
    ? nonZero.slice(0, 2)
    : nonZero.length === 1
      ? nonZero
      : watchParts.slice(0, 1));

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
        <StatCard
          icon={Clock}
          color="emerald"
          label="Total Watch Time"
          value={headlineParts.map(([n, unit], i) => (
            <span key={unit}>
              {i > 0 && " "}
              {n}
              <span className="text-sm font-normal text-theme-secondary"> {unit}</span>
            </span>
          ))}
          hint={<>{days > 0 && `${days}d `}{hours}h {minutes}m · {summary.movie_hours.toFixed(1)}h movies · {summary.tv_hours.toFixed(1)}h TV</>}
        />

        <StatCard
          icon={Film}
          color="blue"
          label="Movies Watched"
          value={summary.movies_watched}
          hint={<>{summary.total_movies} in library</>}
        />

        <StatCard
          icon={Tv}
          color="purple"
          label="Episodes Watched"
          value={summary.episodes_watched}
          hint={<>{summary.series_tracked} series tracked</>}
        />

        <StatCard
          icon={Library}
          color="amber"
          label="Library Total"
          value={summary.total_items}
          hint={<>{summary.watchlist_count} on watchlist</>}
        />
      </div>

      {/* Continue Watching — one card per in-progress show */}
      <ContinueWatching onChange={fetchData} />

      {/* Middle Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#10b981]" />
              Watch Habits
            </span>
          }
        >
          {monthly_activity?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly_activity} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="month" stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip />
                <Line type="monotone" dataKey="movies" name="Movies" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="episodes" name="Episodes" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="Mark items completed or log episodes to see activity." />
          )}
        </ChartCard>

        <ChartCard title="Top Genres">
          {genres?.length > 0 ? (
            <DonutChart
              data={genres}
              dataKey="count"
              nameKey="name"
              centerLabel={genres[0].name}
            />
          ) : (
            <EmptyChartState message="No genre data yet." />
          )}
        </ChartCard>
      </div>

      {/* Language Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <ChartCard title="Top Languages (by count)">
          {data?.languages?.length > 0 ? (
            <DonutChart
              data={data.languages}
              dataKey="count"
              nameKey="code"
              centerLabel={data.languages[0].code.toUpperCase()}
            />
          ) : (
            <EmptyChartState message="No language data yet." />
          )}
        </ChartCard>

        <ChartCard title="Minutes Watched by Language">
          {data?.languages?.length > 0 ? (
            <HorizontalBarChart data={data.languages} categoryKey="code" valueKey="minutes" />
          ) : (
            <EmptyChartState message="No minute data yet." />
          )}
        </ChartCard>
      </div>

      {/* Country Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <ChartCard title="Top Regions (by count)">
          {countriesWithFlags.length > 0 ? (
            <DonutChart
              data={countriesWithFlags}
              dataKey="count"
              nameKey="code"
              centerLabel={countriesWithFlags[0].code}
              centerLabelWidthClass="w-24"
            />
          ) : (
            <EmptyChartState message="No region data yet." />
          )}
        </ChartCard>

        <ChartCard title="Minutes Watched by Region">
          {countriesWithFlags.length > 0 ? (
            <HorizontalBarChart data={countriesWithFlags} categoryKey="code" valueKey="minutes" />
          ) : (
            <EmptyChartState message="No minute data yet." />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <ChartCard
          height="h-64"
          title={
            <span className="flex items-center gap-2 w-full">
              <Trophy className="w-4 h-4 text-amber-500" />
              Rating Distribution
              {summary.avg_rating !== null && (
                <span className="text-xs font-normal text-theme-muted ml-auto">
                  Avg {summary.avg_rating.toFixed(1)}/10
                </span>
              )}
            </span>
          }
        >
          {rating_distribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rating_distribution} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="score" stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip showCursor />
                <Bar dataKey="count" name="Items" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No ratings yet." />
          )}
        </ChartCard>

        <ChartCard
          height="h-64"
          title={
            <span className="flex items-center justify-between w-full">
              <span>Recent Activity</span>
              <Link to="/library" className="text-xs font-medium text-[#10b981] hover:underline">View All</Link>
            </span>
          }
        >
          {recent.length > 0 ? (
            <div className="h-full overflow-y-auto pr-2 space-y-3">
              {recent.map(item => (
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
              ))}
            </div>
          ) : (
            <EmptyChartState message="Your library is empty." />
          )}
        </ChartCard>
      </div>
    </div>
  );
};

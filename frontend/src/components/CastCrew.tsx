import React from "react";
import { User } from "lucide-react";
import type { TmdbCastMember, TmdbCrewMember } from "../lib/api";

interface CastCrewProps {
  cast: TmdbCastMember[] | undefined | null;
  crew: TmdbCrewMember[] | undefined | null;
}

interface PersonCardProps {
  name: string;
  subtitle: string;
  profileUrl: string | null;
}

/**
 * Compact horizontal-scroll card for a single cast or crew member.
 */
const PersonCard: React.FC<PersonCardProps> = ({ name, subtitle, profileUrl }) => (
  <div className="flex-shrink-0 w-32 text-center">
    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-theme-tertiary border border-theme mb-2 flex items-center justify-center">
      {profileUrl ? (
        <img
          src={profileUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <User className="w-10 h-10 text-theme-muted" />
      )}
    </div>
    <div className="text-xs font-medium text-theme-primary line-clamp-2 leading-tight">{name}</div>
    {subtitle && (
      <div className="text-[11px] text-theme-muted line-clamp-2 leading-tight mt-0.5">{subtitle}</div>
    )}
  </div>
);

export const CastCrew: React.FC<CastCrewProps> = ({ cast, crew }) => {
  const castList = (cast ?? []).filter(Boolean);
  const crewList = (crew ?? []).filter(Boolean);

  if (castList.length === 0 && crewList.length === 0) return null;

  // Group crew by department, keep first 8 per department, then keep top jobs only
  const crewByDept = new Map<string, TmdbCrewMember[]>();
  for (const member of crewList) {
    const dept = member.department || "Crew";
    const arr = crewByDept.get(dept) ?? [];
    if (arr.length < 8) arr.push(member);
    crewByDept.set(dept, arr);
  }

  return (
    <section className="dense-card space-y-6">
      {castList.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
            Cast
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:thin]">
            {castList.slice(0, 25).map((member) => (
              <PersonCard
                key={`cast-${member.id}-${member.order}`}
                name={member.name}
                subtitle={member.character || member.known_for_department || ""}
                profileUrl={member.profile_url}
              />
            ))}
          </div>
        </div>
      )}

      {Array.from(crewByDept.entries()).map(([dept, members]) => (
        <div key={dept}>
          <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
            {dept}
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:thin]">
            {members.map((member, i) => (
              <PersonCard
                key={`crew-${dept}-${member.id}-${i}`}
                name={member.name}
                subtitle={member.job}
                profileUrl={member.profile_url}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
};
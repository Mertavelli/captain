"use client";
import { cn } from "@/lib/utils";

function getInitials(first, last) {
  const f = first?.[0]?.toUpperCase() ?? "";
  const l = last?.[0]?.toUpperCase() ?? "";
  return f + l;
}

export const AvatarCircles = ({
  className,
  people = []
}) => {
  const maxToShow = 4;
  const displayed = people.slice(0, maxToShow);
  const hiddenCount = people.length > maxToShow ? people.length - maxToShow : 0;

  return (
    <div className={cn("z-10 flex -space-x-2 rtl:space-x-reverse", className)}>
      {displayed.map((person, index) => (
        <div
          key={index}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-border text-center text-[0.7rem] font-bold text-gray-700 hover:bg-gray-400 dark:border-gray-800 dark:bg-white dark:text-black overflow-hidden shadow-xs"
        >
          {person.imageUrl ? (
            <img
              src={person.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            getInitials(person.first_name, person.last_name)
          )}
        </div>
      ))}
      {hiddenCount > 0 && (
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-black text-center text-[0.7rem] font-medium text-white hover:bg-gray-600 dark:border-gray-800 dark:bg-white dark:text-black"
        >
          +{hiddenCount}
        </div>
      )}
    </div>
  );
};

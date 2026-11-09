import { EntryCard } from "../journal/EntryCard";
import type { JournalEntry } from "../journal/types";
import { SidePanel } from "../ui/SidePanel";

interface FriendEntryPanelProps {
  buildingName: string;
  username: string;
  entry: JournalEntry;
  /** Back to wherever it was opened from: a profile or the feed. */
  onBack: () => void;
  onClose: () => void;
}

/** One friend's entry, opened from their profile or the feed. Read-only. */
export function FriendEntryPanel({
  buildingName,
  username,
  entry,
  onBack,
  onClose,
}: FriendEntryPanelProps) {
  return (
    <SidePanel
      title={buildingName}
      subtitle={`@${username}'s entry`}
      onBack={onBack}
      onClose={onClose}
    >
      <div className="side-panel-body">
        <EntryCard entry={entry} />
      </div>
    </SidePanel>
  );
}

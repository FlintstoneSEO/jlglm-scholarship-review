import type { ApplicationScope } from "@/lib/application-scope";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function ApplicationScopeFilter({
  value,
  onChange,
}: {
  value: ApplicationScope;
  onChange: (scope: ApplicationScope) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="application-scope" className="text-sm font-medium">
        Application type
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as ApplicationScope)}>
        <SelectTrigger id="application-scope" className="min-h-11 w-full sm:w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="real">Real Applications</SelectItem>
          <SelectItem value="test">Test Applications</SelectItem>
          <SelectItem value="all">All Applications</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

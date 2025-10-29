import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { BranchingPointNodeData } from "./types";

function BranchingPointNodeBase({ data }: NodeProps<BranchingPointNodeData>) {
  const { branchingPoint } = data;

  return (
    <div className="w-[640px] rounded-3xl border-2 border-highlight bg-highlight/10 p-4 text-text shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !bg-highlight !border-none"
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-highlight">Choice</p>
      <p className="mt-2 text-sm font-semibold text-text-primary">{branchingPoint.choicePrompt}</p>

      <ul className="mt-3 space-y-1.5">
        {branchingPoint.choices.map((choice) => (
          <li key={`${branchingPoint.id}-${choice.leadsTo}`} className="flex items-start gap-2">
            <span className="mt-0.5 text-sm text-highlight">→</span>
            <span className="text-sm text-text-muted">{choice.label}</span>
          </li>
        ))}
      </ul>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !bg-highlight !border-none"
      />
    </div>
  );
}

export const BranchingPointNode = memo(BranchingPointNodeBase);

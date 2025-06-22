import React, { useState } from 'react';
import { Criterion } from '@/types';

interface Error {
  text: string;
  correction: string;
  type: string;
  explanation: string;
  start?: number;
  end?: number;
}

interface TextHighlighterProps {
  originalText: string;
  errors: Error[];
}

// Helper to normalize apostrophes and quotes
function normalize(str: string) {
  return str
    .replace(/[’‘‛`]/g, "'")
    .replace(/[""„‟]/g, '"')
    .toLowerCase();
}

const TextHighlighter: React.FC<TextHighlighterProps> = ({ originalText, errors }) => {
  const [hoveredError, setHoveredError] = useState<Error | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Helper to find all non-overlapping matches of all errors (case-insensitive, normalized)
  const getHighlightRanges = () => {
    const ranges: Array<{ start: number; end: number; error: Error }> = [];
    const normText = normalize(originalText);
    errors.forEach((error) => {
      if (!error.text) return;
      const normError = normalize(error.text);
      // Use word boundaries for single words
      const isSingleWord = /^\w+$/.test(normError.replace(/'/g, ''));
      let regex;
      if (isSingleWord) {
        regex = new RegExp(`\\b${normError.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      } else {
        regex = new RegExp(normError.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      }
      let match;
      while ((match = regex.exec(normText)) !== null) {
        // Check for overlap
        const start = match.index;
        const end = start + match[0].length;
        const overlap = ranges.some(r => (start < r.end && end > r.start));
        if (!overlap) {
          ranges.push({ start, end, error });
        }
      }
    });
    // Sort by start index
    return ranges.sort((a, b) => a.start - b.start);
  };

  const highlightText = () => {
    if (!errors || errors.length === 0) {
      return <span>{originalText}</span>;
    }
    // If any error has start/end, use position-based highlighting
    if (errors.some(e => typeof e.start === 'number' && typeof e.end === 'number')) {
      // Sort errors by start
      const sorted = [...errors]
        .filter(e => typeof e.start === 'number' && typeof e.end === 'number')
        .sort((a, b) => (a.start! - b.start!));
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      sorted.forEach((err, idx) => {
        if (err.start! > lastIndex) {
          parts.push(<span key={lastIndex + '-normal'}>{originalText.substring(lastIndex, err.start!)}</span>);
        }
        const errorTypeColors = {
          grammar: 'bg-red-200 border-b-2 border-red-400',
          spelling: 'bg-yellow-200 border-b-2 border-yellow-400',
          vocabulary: 'bg-blue-200 border-b-2 border-blue-400',
          style: 'bg-purple-200 border-b-2 border-purple-400'
        };
        const type = ['grammar', 'spelling', 'vocabulary', 'style'].includes(err.type) ? err.type : 'style';
        const colorClass = errorTypeColors[type as keyof typeof errorTypeColors];
        parts.push(
          <span
            key={err.start + '-error'}
            className={`${colorClass} cursor-pointer transition-all duration-200 hover:brightness-90`}
            title={err.explanation}
            onMouseEnter={e => {
              setHoveredError(err);
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltipPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 10
              });
            }}
            onMouseLeave={() => setHoveredError(null)}
          >
            {originalText.substring(err.start!, err.end!)}
          </span>
        );
        lastIndex = err.end!;
      });
      if (lastIndex < originalText.length) {
        parts.push(<span key={lastIndex + '-end'}>{originalText.substring(lastIndex)}</span>);
      }
      return parts;
    }
    // Fallback: old logic
    const normText = normalize(originalText);
    const ranges = getHighlightRanges();
    if (ranges.length === 0) {
      return <span>{originalText}</span>;
    }
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    ranges.forEach((range, idx) => {
      // Find the actual text in the original (not normalized)
      const actualText = originalText.substring(range.start, range.end);
      if (range.start > lastIndex) {
        parts.push(<span key={lastIndex + '-normal'}>{originalText.substring(lastIndex, range.start)}</span>);
      }
      const errorTypeColors = {
        grammar: 'bg-red-200 border-b-2 border-red-400',
        spelling: 'bg-yellow-200 border-b-2 border-yellow-400',
        vocabulary: 'bg-blue-200 border-b-2 border-blue-400',
        style: 'bg-purple-200 border-b-2 border-purple-400'
      };
      // Default to 'style' if type is unrecognized
      const type = ['grammar', 'spelling', 'vocabulary', 'style'].includes(range.error.type) ? range.error.type : 'style';
      const colorClass = errorTypeColors[type as keyof typeof errorTypeColors];
      parts.push(
        <span
          key={range.start + '-error'}
          className={`${colorClass} cursor-pointer transition-all duration-200 hover:brightness-90`}
          title={range.error.explanation}
          onMouseEnter={e => {
            setHoveredError(range.error);
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltipPosition({
              x: rect.left + rect.width / 2,
              y: rect.top - 10
            });
          }}
          onMouseLeave={() => setHoveredError(null)}
        >
          {actualText}
        </span>
      );
      lastIndex = range.end;
    });
    if (lastIndex < originalText.length) {
      parts.push(<span key={lastIndex + '-end'}>{originalText.substring(lastIndex)}</span>);
    }
    return parts;
  };

  return (
    <div className="relative">
      <div className="bg-white/90 p-6 rounded-2xl border-2 border-blue-200 shadow-xl text-base leading-relaxed">
        <h3 className="text-2xl font-extrabold mb-4 text-blue-700 flex items-center gap-2">
          <span role="img" aria-label="Error Analysis">🔍</span> Error Analysis
        </h3>
        <div className="text-gray-700 mb-4">
          {highlightText()}
        </div>
        {/* Error Legend */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-3 font-semibold">Error Types:</div>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-600 border border-red-800 rounded"></div>
              <span className="text-red-900 font-semibold">Grammar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-400 border border-yellow-700 rounded"></div>
              <span className="text-yellow-900 font-semibold">Spelling</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 border border-blue-900 rounded"></div>
              <span className="text-blue-900 font-semibold">Vocabulary</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-600 border border-purple-900 rounded"></div>
              <span className="text-purple-900 font-semibold">Style</span>
            </div>
          </div>
        </div>
      </div>
      {/* Tooltip */}
      {hoveredError && (
        <div
          className="fixed z-50 bg-gray-900 text-white p-4 rounded-xl shadow-2xl max-w-xs transform -translate-x-1/2 -translate-y-full border border-blue-400"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
        >
          <div className="text-base">
            <div className="font-bold text-blue-300 capitalize mb-2">
              {hoveredError.type} Error
            </div>
            <div className="mb-2">
              <span className="text-gray-300">Change:</span>{' '}
              <span className="line-through text-red-300">{hoveredError.text}</span>{' '}
              →{' '}
              <span className="text-green-300 font-bold">{hoveredError.correction}</span>
            </div>
            <div className="text-gray-200 text-xs">
              {hoveredError.explanation}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default TextHighlighter; 
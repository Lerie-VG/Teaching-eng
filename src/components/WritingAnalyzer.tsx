'use client';

import { useState } from 'react';
import { ExamLevel, TaskType, AnalysisResult } from '@/types';
import TextHighlighter from './TextHighlighter';
import CriteriaGrid from './CriteriaGrid';
import { FaSearch } from 'react-icons/fa';

export default function WritingAnalyzer() {
  const [examLevel, setExamLevel] = useState<ExamLevel>('CAE');
  const [taskType, setTaskType] = useState<TaskType>('Essay');
  const [writing, setWriting] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!writing.trim()) {
      setError('Please enter your writing sample');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examLevel,
          taskType,
          writing,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(data.message || 'Failed to analyze writing. Please try again.');
        setResult(null);
        return;
      }

      setResult(data);
    } catch (err) {
      setError('Failed to analyze writing. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 flex flex-col items-center mt-20">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 max-w-5xl w-full mx-auto">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Exam Level
            </label>
            <select
              value={examLevel}
              onChange={(e) => setExamLevel(e.target.value as ExamLevel)}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="CAE">CAE (Advanced)</option>
              <option value="CPE">CPE (Proficiency)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Task Type
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="w-full p-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="Essay">Essay</option>
              <option value="Proposal">Proposal</option>
              <option value="Report">Report</option>
              <option value="Review">Review</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Your Writing
          </label>
          <textarea
            value={writing}
            onChange={(e) => setWriting(e.target.value)}
            className="w-full h-64 p-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400"
            placeholder="Paste your writing here..."
          />
          <div className="text-sm text-gray-900 mt-2">
            Word count: {writing.trim().split(/\s+/).filter(Boolean).length}
          </div>
          {writing.trim().split(/\s+/).filter(Boolean).length > 0 && writing.trim().split(/\s+/).filter(Boolean).length < 150 && (
            <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 rounded">
              Your writing contains only {writing.trim().split(/\s+/).filter(Boolean).length} words. Please provide at least 150 words for a meaningful assessment.
            </div>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-500 text-white py-3 px-6 rounded-full text-lg font-bold shadow-lg hover:from-blue-700 hover:to-purple-600 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-4"
        >
          <FaSearch className="text-xl" />
          {isAnalyzing ? 'Analyzing...' : 'Analyze Writing'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </div>

      {result && (
        <section className="flex flex-col items-center justify-center my-12">
          <h2 className="text-3xl font-extrabold mb-4 text-gray-900 text-center tracking-tight drop-shadow">Analysis Results</h2>
          <div className="flex flex-col items-center mb-8">
            <div className="w-36 h-36 flex items-center justify-center rounded-full bg-green-400 border-10 border-green-200 shadow-lg text-7xl font-extrabold text-white mb-3 animate-pulse">
              {result.overallScore}/5
            </div>
            <div className="text-base text-gray-700 font-semibold tracking-wide">Overall Score</div>
          </div>
          <div className="w-full bg-white/80 rounded-3xl shadow-xl p-8 mb-10 max-w-5xl mx-auto">
            {result.criteria && result.criteria.length === 4 && (
              <CriteriaGrid criteria={result.criteria} />
            )}
            {result.errors && result.errors.length > 0 && (
              <div className="my-10">
                <TextHighlighter originalText={writing} errors={result.errors} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
} 
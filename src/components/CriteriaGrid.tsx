import React from 'react';
import { Criterion } from '@/types';
import { FaRegLightbulb, FaRegComments, FaRegListAlt, FaRegEdit } from 'react-icons/fa';

interface CriteriaGridProps {
  criteria: Criterion[];
}

const getColor = (score: number) => {
  if (score >= 4) return 'bg-green-500 text-white';
  if (score === 3) return 'bg-yellow-400 text-white';
  return 'bg-red-400 text-white';
};

const icons: Record<string, React.ReactNode> = {
  'Content': <FaRegLightbulb className="text-xl text-yellow-500 mr-2" />,
  'Communicative Achievement': <FaRegComments className="text-xl text-blue-500 mr-2" />,
  'Organisation': <FaRegListAlt className="text-xl text-purple-500 mr-2" />,
  'Language': <FaRegEdit className="text-xl text-pink-500 mr-2" />,
};

const CriteriaGrid: React.FC<CriteriaGridProps> = ({ criteria }) => {
  // Ensure the order is always Content, Communicative Achievement, Organisation, Language
  const order = ['Content', 'Communicative Achievement', 'Organisation', 'Language'];
  const sorted = order.map(name => criteria.find(c => c.name === name) || { name, score: 0, feedback: 'No feedback.' });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-8 max-w-3xl mx-auto">
      {sorted.map((criterion) => (
        <div
          key={criterion.name}
          className="relative bg-white rounded-2xl shadow p-6 flex flex-col min-h-[200px] border border-gray-100 transition-transform duration-200 hover:shadow-xl hover:scale-105"
        >
          <div className="flex items-center mb-2">
            {icons[criterion.name]}
            <span className="text-lg font-bold text-gray-900">
              {criterion.name === 'Communicative Achievement' ? (
                <>
                  Communicative<br />
                  <span className="block">Achievement</span>
                </>
              ) : (
                criterion.name
              )}
            </span>
            <span className={`absolute top-6 right-6 px-4 py-1 rounded-full font-bold text-base shadow-sm ${getColor(criterion.score)}`}>
              {criterion.score}/5
            </span>
          </div>
          <div className="text-gray-700 text-base mt-2 font-normal leading-relaxed">
            {criterion.feedback}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CriteriaGrid; 
import { useEffect } from 'react';
import { useDocumentStore } from '../../stores/documentStore';
import { X } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function CPOReviewDrawer() {
  const reviewContent = useDocumentStore((s) => s.reviewContent);
  const isReviewing = useDocumentStore((s) => s.isReviewing);
  const reviewOpen = useDocumentStore((s) => s.reviewOpen);
  const setReviewOpen = useDocumentStore((s) => s.setReviewOpen);

  useEffect(() => {
    if (reviewOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [reviewOpen]);

  if (!reviewOpen) return null;

  const extractOverallScore = (content: string): number | null => {
    const match = content.match(
      /Overall Readiness Score[:\s]+(\d+)/i
    );
    return match ? parseInt(match[1]) : null;
  };

  const overallScore = extractOverallScore(reviewContent);

  const scoreColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-700';
    if (score <= 4) return 'bg-red-100 text-red-700';
    if (score <= 6) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={() => setReviewOpen(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setReviewOpen(false)}
        aria-label="Close review drawer"
      />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-[480px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">CPO Review</h2>
          <button
            onClick={() => setReviewOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isReviewing ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4">
              <LoadingSpinner size="md" />
              <p className="text-sm text-gray-600">Reviewing...</p>
            </div>
          ) : reviewContent ? (
            <div className="space-y-6">
              {overallScore !== null && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">
                    Overall Readiness
                  </span>
                  <div
                    className={`flex items-center justify-center w-16 h-16 rounded-lg font-bold text-2xl ${scoreColor(overallScore)}`}
                  >
                    {overallScore}/10
                  </div>
                </div>
              )}

              <div className="prose prose-sm max-w-none">
                {reviewContent.split('\n\n').map((section, idx) => {
                  const isSectionHeader = section.match(
                    /^(Strategic Gap Analysis|Assumption Audit|User Empathy Score|Analytics Readiness Check|Competitive Blind Spots|Tough Questions|Overall Readiness)/i
                  );

                  if (isSectionHeader) {
                    return (
                      <div key={idx}>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 bg-telus-purple rounded-full" />
                          {section.split('\n')[0]}
                        </h3>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {section.split('\n').slice(1).join('\n')}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <p
                      key={idx}
                      className="text-sm text-gray-700 leading-relaxed"
                    >
                      {section}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-500 text-center">
                No review content yet. Click "Review like a CPO" to start.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

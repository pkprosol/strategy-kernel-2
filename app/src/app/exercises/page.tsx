'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import Chat from '@/components/Chat';
import { EXERCISES, getExercisesByCategory, ExerciseDefinition } from '@/lib/exercises';
import { slugify } from '@/lib/domains';

function ExerciseLibrary() {
  const router = useRouter();
  const [activeExercise, setActiveExercise] = useState<ExerciseDefinition | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const grouped = getExercisesByCategory();

  async function handleExerciseComplete(content: string) {
    if (!activeExercise) return;

    const today = new Date().toISOString().split('T')[0];
    let slug = activeExercise.output_slug;
    if (!slug) {
      // Dynamic slug for reviews/briefs
      if (activeExercise.id === 'weekly-review') slug = `weekly-review-${today}`;
      else if (activeExercise.id === 'daily-brief') slug = today;
      else if (activeExercise.id === 'monthly-review') slug = `monthly-review-${today.slice(0, 7)}`;
      else slug = slugify(activeExercise.output_title) + '-' + today;
    }

    await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: activeExercise.output_domain,
        record_type: activeExercise.output_record_type,
        slug,
        title: activeExercise.output_title,
        content,
        source: 'exercise',
        source_detail: activeExercise.id,
      }),
    });

    setSavedMessage(`Saved to ${activeExercise.output_domain}/${slug}`);
    setTimeout(() => setSavedMessage(''), 5000);
  }

  if (activeExercise) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => setActiveExercise(null)}
              className="text-xs text-zinc-600 hover:text-zinc-400"
            >
              &larr; Exercises
            </button>
            <h2 className="text-xl font-bold text-zinc-100">{activeExercise.name}</h2>
            <p className="text-sm text-zinc-500">{activeExercise.description}</p>
          </div>
          {savedMessage && (
            <span className="text-sm text-green-400">{savedMessage}</span>
          )}
        </div>
        <div className="flex-1">
          <Chat
            context={{ type: 'exercise', exerciseId: activeExercise.id }}
            onExerciseComplete={handleExerciseComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-100 mb-6">Exercises</h2>

      {Object.entries(grouped).map(([category, exercises]) => (
        <div key={category} className="mb-8">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setActiveExercise(ex)}
                className="text-left p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
              >
                <h4 className="font-medium text-zinc-200 mb-1">{ex.name}</h4>
                <p className="text-xs text-zinc-500">{ex.description}</p>
                <p className="text-xs text-zinc-700 mt-2">
                  Output: {ex.output_domain}/{ex.output_record_type}
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExercisesPage() {
  return (
    <Providers>
      <Shell>
        <ExerciseLibrary />
      </Shell>
    </Providers>
  );
}

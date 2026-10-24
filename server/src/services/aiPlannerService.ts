import { getEncryptedKey } from '../models/userSettings';
import { db } from '../db/database';

// Default Gemini endpoint – can be overridden via env var
const DEFAULT_GEMINI_ENDPOINT = process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Helper to call the LLM endpoint.
 * model is currently unused because we only expose Gemini, but kept for future extensibility.
 */
async function callLLM(endpoint: string, apiKey: string, messages: any[]) {
  const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;

  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  const body: any = {
    contents: otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }]
    })),
    tools: [
      {
        functionDeclarations: [
          {
            name: "apply_plan",
            description: "Applies the itinerary to the user's trip by assigning places to specific days and times. Call this if you have formulated a plan and want to enact it.",
            parameters: {
              type: "OBJECT",
              properties: {
                assignments: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      place_id: { type: "INTEGER" },
                      day_id: { type: "INTEGER" },
                      time: { type: "STRING", description: "Time in HH:MM format (optional)" }
                    },
                    required: ["place_id", "day_id"]
                  }
                }
              },
              required: ["assignments"]
            }
          }
        ]
      }
    ]
  };

  if (systemMessages.length > 0) {
    body.system_instruction = {
      parts: systemMessages.map(m => ({ text: m.content }))
    };
  }

  // Debug: Log the request (redacting API key from URL in logs)
  console.log('AI Planner Request Body:', JSON.stringify(body, null, 2));

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error('LLM Request Failed:', resp.status, err);
    throw new Error(`LLM request failed: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  console.log('AI Planner Response Content:', JSON.stringify(data, null, 2));

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find((p: any) => p.text);
  const callPart = parts.find((p: any) => p.functionCall);

  let planApplied = false;
  const undoLog: any[] = [];
  if (callPart?.functionCall?.name === 'apply_plan') {
    const args = callPart.functionCall.args;
    if (args && Array.isArray(args.assignments)) {
      const dbSelect = db.prepare('SELECT day_id, assignment_time, order_index FROM day_assignments WHERE place_id = ?');
      const dbInsert = db.prepare('INSERT INTO day_assignments (day_id, place_id, assignment_time, order_index) VALUES (?, ?, ?, ?)');
      const dbDelete = db.prepare('DELETE FROM day_assignments WHERE place_id = ?');
      let order = 1000;

      const applyAll = db.transaction(() => {
        for (const a of args.assignments) {
          if (a.place_id && a.day_id) {
            const prev = dbSelect.get(a.place_id) as any;
            undoLog.push({
              place_id: a.place_id,
              prev_day_id: prev ? prev.day_id : null,
              prev_time: prev ? prev.assignment_time : null,
              prev_order: prev ? prev.order_index : null
            });

            dbDelete.run(a.place_id);
            dbInsert.run(a.day_id, a.place_id, a.time || null, order++);
          }
        }
      });
      applyAll();
      planApplied = true;
    }
  }

  const text = textPart?.text || (planApplied ? "I have successfully applied the plan to your trip!" : '');
  return { text, planApplied, undoLog };
}

/**
 * Plan the whole trip using unplanned items.
 */
export async function planTrip(tripId: number, userId: number, model: string, prompt?: string, history: any[] = []) {
  const apiKey = getEncryptedKey(userId, 'ai_api_key');
  if (!apiKey) throw new Error('AI API key not configured');

  const unassignedPlaces = db.prepare(
    `SELECT id, name, description, address, duration_minutes, notes FROM places WHERE trip_id = ? AND id NOT IN (SELECT place_id FROM day_assignments)`
  ).all(tripId) as any[];

  const days = db.prepare('SELECT id, day_number, date FROM days WHERE trip_id = ? ORDER BY day_number').all(tripId) as any[];

  let contextInfo = `The trip has ${days.length} days:\n`;
  days.forEach(d => {
    contextInfo += `- Day ID: ${d.id} | Day ${d.day_number}${d.date ? ` (${d.date})` : ''}\n`;
  });

  contextInfo += `\nUnplanned places to consider including:\n`;
  if (unassignedPlaces.length === 0) {
    contextInfo += "- None at the moment\n";
  } else {
    unassignedPlaces.forEach(p => {
      contextInfo += `- (Place ID: ${p.id}) ${p.name}`;
      if (p.address) contextInfo += ` (${p.address})`;
      if (p.duration_minutes) contextInfo += ` - takes ~${p.duration_minutes} mins`;
      if (p.description) contextInfo += `: ${p.description}`;
      if (p.notes) contextInfo += ` [Notes: ${p.notes}]`;
      contextInfo += "\n";
    });
  }

  const systemMessage = {
    role: 'system',
    content: `You are a travel planning assistant. Generate a highly detailed day‑by‑day itinerary for this trip using the provided unassigned places. If you formulate a complete plan, you MUST call the "apply_plan" tool to enact it using the Place IDs and Day IDs.\n\n${contextInfo}`,
  };

  const userMessage = {
    role: 'user',
    content: prompt ? prompt : 'Create a full itinerary and apply it.',
  };
  const endpoint = DEFAULT_GEMINI_ENDPOINT;
  const limitedHistory = (history || []).slice(-10);
  const result = await callLLM(endpoint, apiKey, [systemMessage, ...limitedHistory, userMessage]);
  return { text: result.text, planApplied: result.planApplied, undoLog: result.undoLog };
}

/**
 * Plan a specific day.
 */
export async function planDay(tripId: number, dayId: number, userId: number, model: string, prompt?: string, history: any[] = []) {
  const apiKey = getEncryptedKey(userId, 'ai_api_key');
  if (!apiKey) throw new Error('AI API key not configured');

  const unassignedPlaces = db.prepare(
    `SELECT id, name, description, address, duration_minutes FROM places WHERE trip_id = ? AND id NOT IN (SELECT place_id FROM day_assignments)`
  ).all(tripId) as any[];

  let contextInfo = `The Target Day ID you should use is: ${dayId}\n\n`;

  contextInfo += `Unplanned places you could include in today's schedule:\n`;
  if (unassignedPlaces.length === 0) {
    contextInfo += "- None at the moment\n";
  } else {
    unassignedPlaces.forEach(p => {
      contextInfo += `- (Place ID: ${p.id}) ${p.name}`;
      if (p.duration_minutes) contextInfo += ` (~${p.duration_minutes} mins)`;
      contextInfo += "\n";
    });
  }

  const systemMessage = {
    role: 'system',
    content: `You are a travel planning assistant. Generate a detailed, chronological schedule for this specific day of the trip. Use the unassigned items if they make sense. Respect travel times. If you formulate a complete plan, you MUST call the "apply_plan" tool to enact it using the Place IDs and Day IDs.\n\n${contextInfo}`,
  };

  const userMessage = {
    role: 'user',
    content: prompt ? prompt : 'Create a day itinerary and apply it.',
  };
  const endpoint = DEFAULT_GEMINI_ENDPOINT;
  const limitedHistory = (history || []).slice(-10);
  const result = await callLLM(endpoint, apiKey, [systemMessage, ...limitedHistory, userMessage]);
  return { text: result.text, planApplied: result.planApplied, undoLog: result.undoLog };
}

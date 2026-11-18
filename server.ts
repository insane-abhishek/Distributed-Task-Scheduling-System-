/**
 * server.ts
 * Express.js Backend Server for Distributed Task Scheduling System
 * 
 * Provides RESTful API endpoints for:
 * - Managing tasks (Create, Read, Update, Delete)
 * - Assigning tasks to distributed team members
 * - Retrieving scheduling statistics for dashboard
 * - Listing team members and task distribution counts
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { query } from './db.js';

// In AI Studio, the dev server must always listen on port 3000.
// (Nginx listens on port 8080 and proxies requests to localhost:3000)
function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    return Number(process.argv[portArgIndex + 1]);
  }
  return 3000;
}

const app = express();
const PORT = getPort();

// Enable JSON body parsing for API requests
app.use(express.json());

// ==========================================
// 1. DASHBOARD STATISTICS API
// ==========================================
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
      FROM tasks
    `;
    const results: any = await query(sql);
    const row = results[0] || { total: 0, pending: 0, in_progress: 0, completed: 0 };
    
    res.json({
      success: true,
      data: {
        total: Number(row.total) || 0,
        pending: Number(row.pending) || 0,
        inProgress: Number(row.in_progress) || 0,
        completed: Number(row.completed) || 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

// ==========================================
// 2. TASKS API ENDPOINTS
// ==========================================

// GET all tasks (joined with member details)
app.get('/api/tasks', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT tasks.*, members.name AS member_name, members.email AS member_email 
      FROM tasks 
      LEFT JOIN members ON tasks.assigned_to = members.member_id 
      ORDER BY tasks.task_id DESC
    `;
    const tasks = await query(sql);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
});

// POST: Create a new task
app.post('/api/tasks', async (req: Request, res: Response) => {
  try {
    const { title, assigned_to, priority, deadline, status } = req.body;

    // Simple validation
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const assignedId = assigned_to ? Number(assigned_to) : null;
    const taskPriority = priority || 'Medium';
    const taskDeadline = deadline || null;
    const taskStatus = status || 'Pending';

    const sql = `
      INSERT INTO tasks (title, assigned_to, priority, deadline, status) 
      VALUES (?, ?, ?, ?, ?)
    `;
    const result: any = await query(sql, [title.trim(), assignedId, taskPriority, taskDeadline, taskStatus]);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: {
        task_id: result.insertId,
        title: title.trim(),
        assigned_to: assignedId,
        priority: taskPriority,
        deadline: taskDeadline,
        status: taskStatus
      }
    });
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
});

// PUT: Update an existing task
app.put('/api/tasks/:id', async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const { title, assigned_to, priority, deadline, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const assignedId = assigned_to ? Number(assigned_to) : null;
    const taskPriority = priority || 'Medium';
    const taskDeadline = deadline || null;
    const taskStatus = status || 'Pending';

    const sql = `
      UPDATE tasks 
      SET title = ?, assigned_to = ?, priority = ?, deadline = ?, status = ? 
      WHERE task_id = ?
    `;
    const result: any = await query(sql, [title.trim(), assignedId, taskPriority, taskDeadline, taskStatus, taskId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
});

// PATCH: Quick update task status
app.patch('/api/tasks/:id/status', async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = ['Pending', 'In Progress', 'Completed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const sql = `UPDATE tasks SET status = ? WHERE task_id = ?`;
    const result: any = await query(sql, [status, taskId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: `Task status updated to ${status}` });
  } catch (error: any) {
    console.error('Error updating task status:', error);
    res.status(500).json({ success: false, message: 'Failed to update task status' });
  }
});

// DELETE: Delete a task
app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const sql = `DELETE FROM tasks WHERE task_id = ?`;
    const result: any = await query(sql, [taskId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

// ==========================================
// 3. TEAM MEMBERS API ENDPOINTS
// ==========================================

// GET all team members with assigned task counts
app.get('/api/members', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        members.member_id, 
        members.name, 
        members.email, 
        COUNT(tasks.task_id) AS task_count 
      FROM members 
      LEFT JOIN tasks ON members.member_id = tasks.assigned_to 
      GROUP BY members.member_id 
      ORDER BY members.member_id ASC
    `;
    const members = await query(sql);
    res.json({ success: true, data: members });
  } catch (error: any) {
    console.error('Error fetching members:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch members' });
  }
});

// POST: Add a new team member
app.post('/api/members', async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;

    if (!name || !name.trim() || !email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const sql = `INSERT INTO members (name, email) VALUES (?, ?)`;
    const result: any = await query(sql, [name.trim(), email.trim()]);

    res.status(201).json({
      success: true,
      message: 'Team member added successfully',
      data: {
        member_id: result.insertId,
        name: name.trim(),
        email: email.trim()
      }
    });
  } catch (error: any) {
    console.error('Error adding member:', error);
    res.status(500).json({ success: false, message: 'Failed to add team member' });
  }
});

// ==========================================
// 4. AI TASK RECOMMENDATION API (Gemini)
// ==========================================

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// POST: Recommend best team member for a single task
app.post('/api/ai/recommend-task', async (req: Request, res: Response) => {
  try {
    const { title, priority, deadline, current_assigned_to } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required for AI recommendation.' });
    }

    const members: any = await query(`
      SELECT 
        members.member_id, 
        members.name, 
        members.email, 
        COUNT(tasks.task_id) AS task_count 
      FROM members 
      LEFT JOIN tasks ON members.member_id = tasks.assigned_to 
      GROUP BY members.member_id 
      ORDER BY members.member_id ASC
    `);

    if (!members || members.length === 0) {
      return res.status(400).json({ success: false, message: 'No team members available to recommend.' });
    }

    const existingTasks: any = await query(`
      SELECT tasks.*, members.name AS member_name, members.email AS member_email 
      FROM tasks 
      LEFT JOIN members ON tasks.assigned_to = members.member_id 
      ORDER BY tasks.task_id DESC
    `);

    const ai = getGeminiClient();
    const prompt = `You are helping a college project team schedule tasks in a Distributed Task Scheduling System.
Recommend the best team member to handle the following task based on workload balance (number of active/assigned tasks) and task context.

Target Task:
- Title: ${String(title).trim()}
- Priority: ${priority || 'Medium'}
- Deadline: ${deadline || 'Not specified'}
- Currently Assigned Member ID: ${current_assigned_to || 'Unassigned'}

Team Members and Current Workload:
${members.map((m: any) => `- member_id: ${m.member_id}, name: ${m.name}, assigned_tasks: ${m.task_count}`).join('\n')}

Existing Tasks in System:
${existingTasks.map((t: any) => `- #${t.task_id}: "${t.title}" (Assigned to: ${t.member_name || 'Unassigned'}, Priority: ${t.priority}, Status: ${t.status})`).join('\n')}

Pick one member_id from the Team Members list above and provide a short, clear 1-sentence reason.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommended_member_id: {
              type: Type.INTEGER,
              description: 'The member_id of the recommended team member.',
            },
            recommended_member_name: {
              type: Type.STRING,
              description: 'The full name of the recommended team member.',
            },
            reason: {
              type: Type.STRING,
              description: 'Short 1-sentence reason explaining why this member is recommended.',
            },
          },
          required: ['recommended_member_id', 'recommended_member_name', 'reason'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const matchedMember = members.find(
      (m: any) => Number(m.member_id) === Number(parsed.recommended_member_id)
    ) || members.find(
      (m: any) => m.name.toLowerCase() === String(parsed.recommended_member_name || '').toLowerCase()
    );

    if (!matchedMember) {
      return res.status(502).json({ success: false, message: 'AI returned an unrecognized team member.' });
    }

    res.json({
      success: true,
      data: {
        recommended_member_id: matchedMember.member_id,
        recommended_member_name: matchedMember.name,
        reason: parsed.reason || 'Recommended based on current team workload.',
      },
    });
  } catch (error: any) {
    console.error('Error generating AI task recommendation:', error);
    const status = error?.status || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to generate AI recommendation.',
    });
  }
});

// POST: Generate AI assignment recommendations for all tasks in the table
app.post('/api/ai/recommend-all', async (req: Request, res: Response) => {
  try {
    const members: any = await query(`
      SELECT 
        members.member_id, 
        members.name, 
        members.email, 
        COUNT(tasks.task_id) AS task_count 
      FROM members 
      LEFT JOIN tasks ON members.member_id = tasks.assigned_to 
      GROUP BY members.member_id 
      ORDER BY members.member_id ASC
    `);

    const tasks: any = await query(`
      SELECT tasks.*, members.name AS member_name, members.email AS member_email 
      FROM tasks 
      LEFT JOIN members ON tasks.assigned_to = members.member_id 
      ORDER BY tasks.task_id DESC
    `);

    if (!tasks || tasks.length === 0 || !members || members.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const ai = getGeminiClient();
    const prompt = `You are a task scheduling assistant for a Distributed Task Scheduling System.
For EACH task below, recommend the best team member from the members list to balance workload and match task context. For tasks already marked "Completed", recommend keeping the current assignee or note completion.

Team Members:
${members.map((m: any) => `- member_id: ${m.member_id}, name: ${m.name}, current_task_count: ${m.task_count}`).join('\n')}

Tasks:
${tasks.map((t: any) => `- task_id: ${t.task_id}, title: "${t.title}", assigned_to: ${t.member_name || 'Unassigned'} (id: ${t.assigned_to || 'none'}), priority: ${t.priority}, deadline: ${t.deadline || 'none'}, status: ${t.status}`).join('\n')}

Return one recommendation object per task_id with a concise 1-sentence reason (under 18 words).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              task_id: { type: Type.INTEGER, description: 'The task_id from the Tasks list.' },
              recommended_member_id: { type: Type.INTEGER, description: 'Recommended member_id.' },
              recommended_member_name: { type: Type.STRING, description: 'Recommended member full name.' },
              reason: { type: Type.STRING, description: 'Short reason under 18 words.' },
            },
            required: ['task_id', 'recommended_member_id', 'recommended_member_name', 'reason'],
          },
        },
      },
    });

    const parsedList = JSON.parse((response.text ?? '[]').trim());
    const validRecommendations = (Array.isArray(parsedList) ? parsedList : [])
      .map((item: any) => {
        const matchedMember = members.find(
          (m: any) => Number(m.member_id) === Number(item.recommended_member_id)
        );
        if (!matchedMember) return null;
        return {
          task_id: Number(item.task_id),
          recommended_member_id: matchedMember.member_id,
          recommended_member_name: matchedMember.name,
          reason: item.reason || 'Balanced workload assignment.',
        };
      })
      .filter(Boolean);

    res.json({ success: true, data: validRecommendations });
  } catch (error: any) {
    console.error('Error generating bulk AI recommendations:', error);
    const status = error?.status || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to generate AI recommendations.',
    });
  }
});

// POST: Generate overall AI teamwork & workload insight for Dashboard
app.post('/api/ai/team-insights', async (req: Request, res: Response) => {
  try {
    const members: any = await query(`
      SELECT 
        members.member_id, 
        members.name, 
        members.email, 
        COUNT(tasks.task_id) AS task_count 
      FROM members 
      LEFT JOIN tasks ON members.member_id = tasks.assigned_to 
      GROUP BY members.member_id 
      ORDER BY members.member_id ASC
    `);

    const tasks: any = await query(`
      SELECT tasks.*, members.name AS member_name, members.email AS member_email 
      FROM tasks 
      LEFT JOIN members ON tasks.assigned_to = members.member_id 
      ORDER BY tasks.task_id DESC
    `);

    const ai = getGeminiClient();
    const prompt = `Analyze the current task distribution for this college project team and give practical teamwork recommendations.

Team Members:
${members.map((m: any) => `- ${m.name}: ${m.task_count} task(s)`).join('\n')}

Tasks:
${tasks.map((t: any) => `- #${t.task_id} "${t.title}" | Assigned: ${t.member_name || 'Unassigned'} | Priority: ${t.priority} | Deadline: ${t.deadline || 'None'} | Status: ${t.status}`).join('\n')}

Provide a brief 1-sentence overall summary and 3 concise actionable teamwork tips.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'One sentence overall teamwork status.' },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 concise actionable teamwork recommendations.',
            },
          },
          required: ['summary', 'tips'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error generating AI team insights:', error);
    const status = error?.status || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to generate AI teamwork insights.',
    });
  }
});

// ==========================================
// 5. FRONTEND SERVING (Vite in Dev / Static in Prod)
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
  } else {
    // Mount Vite middleware for fast development & hot updates
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Server] Distributed Task Scheduling System running at http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('❌ [Server] Listen error:', err);
  });
}

startServer();

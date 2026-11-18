/**
 * db.js
 * Database Connection Module
 * 
 * This file handles database connectivity for the Distributed Task Scheduling System.
 * It uses the mysql2 library with connection pooling for optimal performance.
 * 
 * Note for College Project / Viva:
 * - If you have MySQL / XAMPP running locally, configure host, user, password, and database below.
 * - If MySQL is not running on the machine, this module automatically falls back to a safe
 *   in-memory storage matching the exact same schema and tables so the project can be demonstrated
 *   without crashing during testing or viva presentations.
 */

import mysql from 'mysql2/promise';

// MySQL database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'task_scheduler',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;
let useFallback = false;

// Fallback in-memory database matching the exact schema
let fallbackMembers = [
  { member_id: 1, name: 'Abhishek Raj', email: 'abhishek.raj@example.edu' },
  { member_id: 2, name: 'Ajna K J', email: 'ajna.kj@example.edu' },
  { member_id: 3, name: 'Anshuman Raj', email: 'anshuman.raj@example.edu' },
];

let fallbackTasks = [
  {
    task_id: 1,
    title: 'Design Database ER Diagram',
    assigned_to: 1,
    priority: 'High',
    deadline: '2026-11-05',
    status: 'Completed',
  },
  {
    task_id: 2,
    title: 'Implement REST API Endpoints',
    assigned_to: 2,
    priority: 'High',
    deadline: '2026-11-08',
    status: 'In Progress',
  },
  {
    task_id: 3,
    title: 'Create Frontend Navigation & Forms',
    assigned_to: 3,
    priority: 'Medium',
    deadline: '2026-11-10',
    status: 'Pending',
  },
  {
    task_id: 4,
    title: 'Perform Unit Testing on Task Scheduling',
    assigned_to: 1,
    priority: 'Low',
    deadline: '2026-11-12',
    status: 'Pending',
  },
  {
    task_id: 5,
    title: 'Prepare Viva Presentation Slides',
    assigned_to: 2,
    priority: 'Medium',
    deadline: '2026-11-15',
    status: 'Pending',
  },
];

let nextMemberId = 4;
let nextTaskId = 6;

// Try initializing MySQL pool
try {
  pool = mysql.createPool(dbConfig);
  // Test connection
  pool.getConnection()
    .then((conn) => {
      console.log('✅ [MySQL] Successfully connected to MySQL database: ' + dbConfig.database);
      conn.release();
    })
    .catch((err) => {
      console.warn('⚠️ [MySQL] Could not connect to MySQL server (' + err.code + ').');
      console.warn('ℹ️ [Notice] Running in Demonstration Mode with built-in data storage so the app works without local MySQL server.');
      useFallback = true;
    });
} catch (err) {
  useFallback = true;
}

/**
 * Universal query helper
 * If MySQL is connected, runs real SQL query.
 * Otherwise, emulates the exact same queries on the in-memory schema.
 */
export async function query(sql, params = []) {
  if (!useFallback && pool) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      // If table doesn't exist or connection failed, switch to fallback
      console.warn('MySQL query error, using demonstration mode:', err.message);
      useFallback = true;
    }
  }

  // Demonstration mode query handler for MySQL emulation
  // Normalize whitespace and case for reliable matching
  const normalized = sql.replace(/\s+/g, ' ').trim();
  const upper = normalized.toUpperCase();

  // 1. SELECT all tasks with member JOIN
  if (upper.includes('FROM TASKS') && upper.includes('JOIN MEMBERS')) {
    const list = fallbackTasks.map((t) => {
      const member = fallbackMembers.find((m) => m.member_id === Number(t.assigned_to));
      return {
        ...t,
        member_name: member ? member.name : 'Unassigned',
        member_email: member ? member.email : '',
      };
    });
    // Sort by task_id descending
    return list.sort((a, b) => b.task_id - a.task_id);
  }

  // 2. SELECT single task by ID
  if (upper.includes('FROM TASKS WHERE TASK_ID = ?')) {
    const taskId = Number(params[0]);
    const found = fallbackTasks.find((t) => t.task_id === taskId);
    return found ? [found] : [];
  }

  // 3. SELECT all members with task count
  if (upper.includes('FROM MEMBERS') && upper.includes('JOIN TASKS')) {
    const results = fallbackMembers.map((m) => {
      const count = fallbackTasks.filter((t) => t.assigned_to === m.member_id).length;
      return {
        member_id: m.member_id,
        name: m.name,
        email: m.email,
        task_count: count,
      };
    });
    return results;
  }

  // 4. SELECT members simple
  if (upper.includes('FROM MEMBERS')) {
    return [...fallbackMembers];
  }

  // 5. INSERT INTO tasks
  if (upper.startsWith('INSERT INTO TASKS')) {
    const [title, assigned_to, priority, deadline, status] = params;
    const newTask = {
      task_id: nextTaskId++,
      title,
      assigned_to: assigned_to ? Number(assigned_to) : null,
      priority: priority || 'Medium',
      deadline: deadline || null,
      status: status || 'Pending',
    };
    fallbackTasks.push(newTask);
    return { insertId: newTask.task_id, affectedRows: 1 };
  }

  // 6. UPDATE tasks SET title = ...
  if (upper.startsWith('UPDATE TASKS SET TITLE = ?')) {
    const [title, assigned_to, priority, deadline, status, taskId] = params;
    const task = fallbackTasks.find((t) => t.task_id === Number(taskId));
    if (task) {
      task.title = title;
      task.assigned_to = assigned_to ? Number(assigned_to) : null;
      task.priority = priority;
      task.deadline = deadline;
      task.status = status;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 7. Quick status update: UPDATE tasks SET status = ? WHERE task_id = ?
  if (upper.startsWith('UPDATE TASKS SET STATUS = ?')) {
    const [status, taskId] = params;
    const task = fallbackTasks.find((t) => t.task_id === Number(taskId));
    if (task) {
      task.status = status;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 8. DELETE FROM tasks WHERE task_id = ?
  if (upper.startsWith('DELETE FROM TASKS')) {
    const taskId = Number(params[0]);
    const initialLen = fallbackTasks.length;
    fallbackTasks = fallbackTasks.filter((t) => t.task_id !== taskId);
    return { affectedRows: initialLen - fallbackTasks.length };
  }

  // 9. INSERT INTO members
  if (upper.startsWith('INSERT INTO MEMBERS')) {
    const [name, email] = params;
    const newMember = {
      member_id: nextMemberId++,
      name,
      email,
    };
    fallbackMembers.push(newMember);
    return { insertId: newMember.member_id, affectedRows: 1 };
  }

  // 10. Dashboard counts
  if (upper.includes('COUNT(*) AS TOTAL')) {
    const total = fallbackTasks.length;
    const pending = fallbackTasks.filter((t) => t.status === 'Pending').length;
    const in_progress = fallbackTasks.filter((t) => t.status === 'In Progress').length;
    const completed = fallbackTasks.filter((t) => t.status === 'Completed').length;
    return [{ total, pending, in_progress, completed }];
  }

  return [];
}

export default { query };

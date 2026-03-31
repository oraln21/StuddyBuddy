// Sprint 3 - StudyBuddy Application
// Author: Nilay
// Express routes for Sprint 3 required pages

"use strict";

const express = require("express");
const path = require("path");
const db = require("./services/db");

const app = express();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "../static")));
app.use(express.urlencoded({ extended: true }));

// Home page
app.get("/", (req, res) => {
  res.render("index", { title: "StudyBuddy" });
});

// Users list – shows all registered students
app.get("/users", async (req, res) => {
  try {
    const users = await db.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.academic_level,
             d.name AS department, uni.name AS university
      FROM user u
      INNER JOIN department d ON u.department_id = d.department_id
      INNER JOIN university uni ON u.university_id = uni.university_id
      ORDER BY u.last_name, u.first_name
    `);
    res.render("users", { title: "All Study Buddies", users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).render("error", { message: "Could not load users." });
  }
});

// User profile page – individual student detail
app.get("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).render("error", { message: "Invalid user ID." });

  try {
    const [user] = await db.query(
      `SELECT u.*, d.name AS department, uni.name AS university
       FROM user u
       JOIN department d ON u.department_id = d.department_id
       JOIN university uni ON u.university_id = uni.university_id
       WHERE u.user_id = ?`,
      [id]
    );
    if (!user) return res.status(404).render("error", { message: "User not found." });

    const skills = await db.query(
      `SELECT s.skill_name, us.proficiency_level FROM user_skill us
       JOIN skill s ON us.skill_id = s.skill_id WHERE us.user_id = ?`,
      [id]
    );
    const courses = await db.query(
      `SELECT c.course_code, c.course_name, e.semester, e.year
       FROM enrollment e JOIN course c ON e.course_id = c.course_id WHERE e.user_id = ?`,
      [id]
    );
    res.render("profile", { title: `${user.first_name} ${user.last_name}`, user, skills, courses });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", { message: "Could not load profile." });
  }
});

// Listing page – all study sessions
app.get("/sessions", async (req, res) => {
  const { tag } = req.query;
  try {
    let sql = `
      SELECT ss.session_id, ss.topic, ss.location, ss.scheduled_time,
             ss.max_participants, u.first_name, u.last_name,
             (SELECT COUNT(*) FROM session_participant sp WHERE sp.session_id = ss.session_id) AS joined
      FROM study_session ss
      JOIN user u ON ss.created_by = u.user_id
    `;
    const params = [];
    if (tag) { sql += ` WHERE ss.topic LIKE ?`; params.push(`%${tag}%`); }
    sql += ` ORDER BY ss.scheduled_time ASC`;

    const sessions = await db.query(sql, params);
    res.render("sessions", { title: "Study Sessions", sessions, selectedTag: tag });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", { message: "Could not load sessions." });
  }
});

// Detail page – single session
app.get("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [session] = await db.query(
      `SELECT ss.*, u.first_name, u.last_name, u.user_id AS organiser_id
       FROM study_session ss JOIN user u ON ss.created_by = u.user_id WHERE ss.session_id = ?`,
      [id]
    );
    if (!session) return res.status(404).render("error", { message: "Session not found." });

    const participants = await db.query(
      `SELECT u.user_id, u.first_name, u.last_name, sp.status
       FROM session_participant sp JOIN user u ON sp.user_id = u.user_id WHERE sp.session_id = ?`,
      [id]
    );
    res.render("session-detail", { title: session.topic, session, participants });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", { message: "Could not load session." });
  }
});

// Tags / Categories
app.get("/tags", async (req, res) => {
  try {
    const tags = await db.query(
      `SELECT topic AS tag, COUNT(*) AS total FROM study_session GROUP BY topic ORDER BY total DESC`
    );
    res.render("tags", { title: "Browse Topics", tags });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", { message: "Could not load topics." });
  }
});

app.listen(3000, () => console.log("StudyBuddy running at http://127.0.0.1:3000/"));

import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import React, { useState } from 'react';

export const mockActions = [
    {
        id: 'task-001',
        title: 'Reminder für Deadline setzen',
        description: 'Projekt X droht überfällig zu werden. Soll ein Reminder an Lisa gesendet werden?',
        endpoint: '/api/send-reminder',
        dateTime: '2025-07-22T10:00:00Z',
        flowElements: [
            { id: '1', type: 'input', data: { label: '📅 Deadline prüfen' } },
            { id: '2', data: { label: '📨 Reminder an Lisa' } },
            { id: 'e1-2', source: '1', target: '2' },
        ],
    },
    {
        id: 'task-002',
        title: 'Neues Arbeitspaket anlegen',
        description: 'Ein Arbeitspaket für QA-Tests soll erstellt und Jonas zugewiesen werden.',
        endpoint: '/api/create-task',
        dateTime: '2025-07-22T11:30:00Z',
        flowElements: [
            { id: '1', type: 'input', data: { label: '🧪 QA Paket erstellen' } },
            { id: '2', data: { label: '👤 Jonas zuweisen' } },
            { id: 'e1-2', source: '1', target: '2' },
        ],
    },
    {
        id: 'task-003',
        title: 'Budgetwarnung verschicken',
        description: 'Projekt Y hat 90% des geplanten Budgets erreicht. Soll eine Warnung an den Projektleiter gesendet werden?',
        endpoint: '/api/send-budget-warning',
        dateTime: '2025-07-22T09:15:00Z',
        flowElements: [
            { id: '1', type: 'input', data: { label: '📊 Budget prüfen' } },
            { id: '2', data: { label: '⚠️ Warnung vorbereiten' } },
            { id: '3', type: 'output', data: { label: '📩 Mail senden' } },
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' },
        ],
    },
    {
        id: 'task-004',
        title: 'Statusbericht generieren',
        description: 'Ein wöchentlicher Statusbericht für Projekt Z ist fällig. Soll ein automatischer Bericht erstellt und versendet werden?',
        endpoint: '/api/generate-status-report',
        dateTime: '2025-07-22T08:45:00Z',
        flowElements: [
            { id: '1', type: 'input', data: { label: '📦 Projektdaten sammeln' } },
            { id: '2', data: { label: '📄 Bericht generieren' } },
            { id: '3', type: 'output', data: { label: '📬 Bericht senden' } },
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' },
        ],
    },
];

export const mockProjects = [
    {
        id: 'alpha',
        name: 'Project Alpha',
        description: 'AI-gestütztes Dashboard für Roadmaps',
        createdAt: '22. Juli 2025',
        status: 'Aktiv',
    },
    {
        id: 'bravo',
        name: 'Project Bravo',
        description: 'Analyse-Bot für Jira & Slack',
        createdAt: '22. Juli 2025',
        status: 'In Planung',
    },
    {
        id: 'charlie',
        name: 'Project Charlie',
        description: 'Rework-Tracker für dev-heavy Teams',
        createdAt: '22. Juli 2025',
        status: 'In Planung',
    },
    {
        id: 'delta',
        name: 'Project Delta',
        description: 'AI-gestütztes Meeting-Recap mit Aufgabenverteilung',
        createdAt: '22. Juli 2025',
        status: 'In Review',
    },
]

export const mockEntries = [
    { type: "typing", text: "> Initialisiere Captain AI-Projektleiter…" },
    { type: "animated", delay: 1000, text: "✔ Strategie-Modul geladen.", color: "green" },
    { type: "animated", delay: 1600, text: "✔ Zugriff auf Slack-Workspace verifiziert.", color: "green" },
    { type: "animated", delay: 2100, text: "✔ Aufgaben aus Jira geladen (17 Tasks erkannt).", color: "green" },
    { type: "animated", delay: 2600, text: "✔ Kontextanalyse abgeschlossen.", color: "green" },
    { type: "animated", delay: 3100, text: "⚠ 3 Tasks ohne verantwortliche Person erkannt.", color: "yellow" },
    {
        type: "animated",
        delay: 3600,
        text: ["ℹ Vorschlag erstellt:", "- @lucas für 'API-Rate-Limit prüfen'"],
        color: "blue"
    },
    { type: "animated", delay: 4200, text: "✔ Blocker-Detection aktiv (Polling alle 3 Minuten).", color: "green" },
    { type: "animated", delay: 4700, text: "✔ Neue Tasks priorisiert nach Cycle-Time-Risiko.", color: "green" },
    {
        type: "animated",
        delay: 5200,
        text: ["ℹ 2 Dateien aktualisiert:", "- agents/syncAgent.ts", "- utils/priorityMap.ts"],
        color: "blue"
    },
    { type: "typing", delay: 5800, text: "Status: ✅ Projektstruktur optimiert & synchronisiert." },
    { type: "typing", delay: 6400, text: "Nächster Schritt: Weekly Update generieren…" },
    { type: "animated", delay: 6900, text: "✔ Slack-Update vorbereitet (Preview verfügbar).", color: "green" },
    { type: "typing", delay: 7400, text: "→ Captain bleibt im Hintergrund aktiv." }
];


export const mockBlockerData = {
    blockers: [
        {
            task_key: 'BIDA-2',
            type: 'critical',
            message: 'Hängt von Backend-API ab.',
            recommendation: 'Mit dem API-Team abstimmen.'
        },
        {
            task_key: 'BIDA-3',
            type: 'warning',
            message: 'Unklare Anforderungen.',
            recommendation: 'Product Owner kontaktieren.'
        }
    ],
    captain_notes: [
        {
            key: 'BIDA-2',
            title: 'BIDA-2 ist blockiert',
            description: 'Backend fehlt.',
            type: 'critical',
            icon: AlertCircle, // Lucide Icon-Komponente
            timestamp: '2m ago'
        },
        {
            key: 'BIDA-3',
            title: 'BIDA-3 unklar definiert',
            description: 'Anforderungen noch nicht eindeutig.',
            type: 'warning',
            icon: AlertTriangle,
            timestamp: '4m ago'
        },
        {
            key: 'BIDA-5',
            title: 'BIDA-5 wurde aktualisiert',
            description: 'Bitte prüfen.',
            type: 'info',
            icon: Info,
            timestamp: '7m ago'
        }
    ]
}

export const reviews = [
    {
        name: "Jack",
        username: "@jack",
        body: "I've never seen anything like this before. It's amazing. I love it.",
        img: "https://avatar.vercel.sh/jack",
    },
    {
        name: "Jill",
        username: "@jill",
        body: "I don't know what to say. I'm speechless. This is amazing.",
        img: "https://avatar.vercel.sh/jill",
    },
    {
        name: "John",
        username: "@john",
        body: "I'm at a loss for words. This is amazing. I love it.",
        img: "https://avatar.vercel.sh/john",
    },
    {
        name: "Jane",
        username: "@jane",
        body: "I'm at a loss for words. This is amazing. I love it.",
        img: "https://avatar.vercel.sh/jane",
    },
    {
        name: "Jenny",
        username: "@jenny",
        body: "I'm at a loss for words. This is amazing. I love it.",
        img: "https://avatar.vercel.sh/jenny",
    },
    {
        name: "James",
        username: "@james",
        body: "I'm at a loss for words. This is amazing. I love it.",
        img: "https://avatar.vercel.sh/james",
    },
];

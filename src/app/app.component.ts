import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface StudyTopic {
  id: number;
  subject: string;
  title: string;
  date: string;
  html: string;
  revised: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements AfterViewInit {
  @ViewChild('editor') editor?: ElementRef<HTMLDivElement>;

  constructor(private sanitizer: DomSanitizer) {}

  searchText = '';
  selectedId = 1;
  showTopicForm = false;
  isEditingTopic = false;
  topicForm = { subject: '', title: '', date: this.today() };
  currentTab: 'notes' | 'pdf' | 'image' = 'notes';
  fontFamily = 'Arial';
  fontSize = '16px';
  statusMessage = '';
  private statusTimer?: ReturnType<typeof setTimeout>;
  private nextId = 4;
  private savedRange: Range | null = null;
  pdfUrl: string | null = null;
  safePdfUrl: SafeResourceUrl | null = null;
  imageUrl: string | null = null;
  pdfName = '';
  imageName = '';
  pdfPage = 1;
  pdfZoom = 100;
  imageZoom = 100;

  topics: StudyTopic[] = this.loadTopics();

  ngAfterViewInit(): void {
    this.loadEditorContent();
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get selectedTopic(): StudyTopic {
    return this.topics.find(t => t.id === this.selectedId) ?? this.topics[0];
  }

  get subjects(): string[] {
    return [...new Set(this.topics.map(t => t.subject))];
  }

  get filteredTopics(): StudyTopic[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.topics;
    return this.topics.filter(t =>
      `${t.subject} ${t.title} ${this.stripHtml(t.html)}`.toLowerCase().includes(q)
    );
  }

  topicsForSubject(subject: string): StudyTopic[] {
    return this.filteredTopics.filter(t => t.subject === subject);
  }

  private stripHtml(html: string): string {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el.textContent ?? '';
  }

  private defaultTopics(): StudyTopic[] {
    return [
      {
        id: 1, subject: 'Git', title: 'Introduction', date: '2026-10-22', revised: false,
        html: '<p>Git is a version control system.</p><h2>Key Git Concepts</h2><ul><li><strong>Repository:</strong> A folder where Git tracks your project and its history.</li><li><strong>Clone:</strong> Make a copy of a remote repository on your computer.</li><li><strong>Stage:</strong> Tell Git which changes you want to save next.</li><li><strong>Commit:</strong> Save a snapshot of your staged changes.</li><li><strong>Branch:</strong> Work on different versions or features at the same time.</li><li><strong>Merge:</strong> Combine changes from different branches.</li><li><strong>Pull:</strong> Get the latest changes from a remote repository.</li><li><strong>Push:</strong> Send your changes to a remote repository.</li></ul>'
      },
      {
        id: 2, subject: 'HTML', title: 'Semantic HTML elements', date: '2026-10-21', revised: true,
        html: '<h2>Semantic HTML</h2><p>Semantic elements describe the meaning of their content.</p><ul><li><strong>&lt;header&gt;:</strong> Introductory content.</li><li><strong>&lt;main&gt;:</strong> The main page content.</li><li><strong>&lt;footer&gt;:</strong> Footer information.</li></ul>'
      },
      {
        id: 3, subject: 'CSS', title: 'The box model', date: '2026-10-20', revised: false,
        html: '<h2>CSS Box Model</h2><p>Every HTML element is represented as a box.</p><ul><li><strong>Content:</strong> Text or image.</li><li><strong>Padding:</strong> Space inside the border.</li><li><strong>Border:</strong> Outline around the padding and content.</li><li><strong>Margin:</strong> Space outside the border.</li></ul>'
      }
    ];
  }

  private loadTopics(): StudyTopic[] {
    try {
      const saved = localStorage.getItem('myStudyReaderAngularTopics');
      return saved ? JSON.parse(saved) as StudyTopic[] : this.defaultTopics();
    } catch {
      return this.defaultTopics();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem('myStudyReaderAngularTopics', JSON.stringify(this.topics));
      this.toast('Saved in this browser');
    } catch {
      this.toast('Browser storage is full. Please shorten your notes.');
    }
  }

  private toast(message: string): void {
    this.statusMessage = message;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => this.statusMessage = '', 2200);
  }

  selectTopic(topic: StudyTopic): void {
    this.saveCurrentEditor();
    this.selectedId = topic.id;
    this.currentTab = 'notes';
    setTimeout(() => this.loadEditorContent());
  }

  loadEditorContent(): void {
    if (this.editor && this.selectedTopic) {
      this.editor.nativeElement.innerHTML = this.selectedTopic.html || '';
      this.applyBaseFont();
    }
  }

  saveCurrentEditor(): void {
    if (!this.editor || !this.selectedTopic) return;
    this.selectedTopic.html = this.editor.nativeElement.innerHTML;
    this.persist();
  }

  onEditorInput(): void {
    this.saveCurrentEditor();
  }

  rememberSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (this.editor?.nativeElement.contains(range.commonAncestorContainer)) {
      this.savedRange = range.cloneRange();
    }
  }

  private restoreSelection(): boolean {
    if (!this.savedRange || !this.editor) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    this.editor.nativeElement.focus();
    selection.removeAllRanges();
    selection.addRange(this.savedRange);
    return true;
  }

  format(command: string, value?: string): void {
    if (!this.restoreSelection()) {
      this.toast('First select text inside your notes');
      return;
    }
    document.execCommand(command, false, value);
    this.rememberSelection();
    this.saveCurrentEditor();
  }

  setFontFamily(): void {
    if (!this.restoreSelection()) {
      this.applyBaseFont();
      this.toast('Select text first to change only that text');
      return;
    }
    this.format('fontName', this.fontFamily);
  }

  setFontSize(): void {
    if (!this.restoreSelection()) {
      this.toast('Select text first to change only that text');
      return;
    }
    const pxToLegacySize: Record<string, string> = {
      '12px': '2', '14px': '3', '16px': '3', '18px': '4', '20px': '5', '24px': '6', '32px': '7'
    };
    this.format('fontSize', pxToLegacySize[this.fontSize] ?? '3');
    this.editor?.nativeElement.querySelectorAll('font[size]').forEach(node => {
      const font = node as HTMLElement;
      font.removeAttribute('size');
      font.style.fontSize = this.fontSize;
    });
  }

  applyBaseFont(): void {
    if (this.editor) this.editor.nativeElement.style.fontFamily = 'Arial, sans-serif';
  }

  importMarkdown(): void {
    const input = document.createElement('textarea');
    input.placeholder = 'Paste Markdown content here';
    input.value = '';
    // A small dialog keeps the project dependency-free for paste/import.
    const markdown = window.prompt('Paste your Markdown notes here (## headings, - bullets, **bold**):');
    if (markdown === null || !markdown.trim()) return;
    this.editor!.nativeElement.innerHTML = this.markdownToHtml(markdown);
    this.saveCurrentEditor();
    this.toast('Markdown formatted and saved');
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char] ?? char));
  }

  private markdownToHtml(markdown: string): string {
    const lines = markdown.replace(/\r/g, '').split('\n');
    let html = '';
    let list: 'ul' | 'ol' | null = null;
    const closeList = () => {
      if (list) html += `</${list}>`;
      list = null;
    };
    const inline = (line: string) => this.escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { closeList(); continue; }
      if (/^#{1,3}\s/.test(line)) {
        closeList();
        const level = Math.min(3, line.match(/^#+/)![0].length);
        html += `<h${level}>${inline(line.replace(/^#{1,3}\s/, ''))}</h${level}>`;
      } else if (/^[-*]\s/.test(line)) {
        if (list !== 'ul') { closeList(); list = 'ul'; html += '<ul>'; }
        html += `<li>${inline(line.slice(2))}</li>`;
      } else if (/^\d+\.\s/.test(line)) {
        if (list !== 'ol') { closeList(); list = 'ol'; html += '<ol>'; }
        html += `<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`;
      } else {
        closeList();
        html += `<p>${inline(line)}</p>`;
      }
    }
    closeList();
    return html;
  }

  openTopicForm(): void {
    this.isEditingTopic = false;
    this.topicForm = { subject: '', title: '', date: this.today() };
    this.showTopicForm = true;
  }

  editTopic(): void {
    const t = this.selectedTopic;
    this.isEditingTopic = true;
    this.topicForm = { subject: t.subject, title: t.title, date: t.date };
    this.showTopicForm = true;
  }

  saveTopicForm(): void {
    const subject = this.topicForm.subject.trim();
    const title = this.topicForm.title.trim();
    if (!subject || !title) { this.toast('Enter both subject and title'); return; }
    if (this.isEditingTopic) {
      this.selectedTopic.subject = subject;
      this.selectedTopic.title = title;
      this.selectedTopic.date = this.topicForm.date;
    } else {
      const topic: StudyTopic = {
        id: this.nextId++, subject, title, date: this.topicForm.date, html: '<p>Start writing your notes here...</p>', revised: false
      };
      this.topics.unshift(topic);
      this.selectedId = topic.id;
    }
    this.showTopicForm = false;
    this.persist();
    setTimeout(() => this.loadEditorContent());
  }

  deleteTopic(): void {
    if (!confirm(`Delete "${this.selectedTopic.title}"?`)) return;
    this.topics = this.topics.filter(t => t.id !== this.selectedId);
    if (this.topics.length === 0) this.topics = this.defaultTopics();
    this.selectedId = this.topics[0].id;
    this.persist();
    setTimeout(() => this.loadEditorContent());
  }

  toggleRevised(): void {
    this.selectedTopic.revised = !this.selectedTopic.revised;
    this.persist();
  }

  get revisedCount(): number {
    return this.topics.filter(t => t.revised).length;
  }

  chooseFile(type: 'pdf' | 'image', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (type === 'pdf') {
      if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
      this.pdfUrl = URL.createObjectURL(file);
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl + '#page=1&zoom=100');
      this.pdfName = file.name;
      this.currentTab = 'pdf';
      this.pdfPage = 1;
    } else {
      if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
      this.imageUrl = URL.createObjectURL(file);
      this.imageName = file.name;
      this.currentTab = 'image';
      this.imageZoom = 100;
    }
    input.value = '';
  }

  changePdfPage(delta: number): void {
    this.pdfPage = Math.max(1, this.pdfPage + delta);
    this.updatePdfPreviewUrl();
  }

  changePdfZoom(delta: number): void {
    this.pdfZoom = Math.min(200, Math.max(50, this.pdfZoom + delta));
    this.updatePdfPreviewUrl();
  }

  private updatePdfPreviewUrl(): void {
    if (this.pdfUrl) {
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `${this.pdfUrl}#page=${this.pdfPage}&zoom=${this.pdfZoom}`
      );
    }
  }

  changeImageZoom(delta: number): void {
    this.imageZoom = Math.min(200, Math.max(25, this.imageZoom + delta));
  }
}
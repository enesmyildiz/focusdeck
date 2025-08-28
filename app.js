// FocusDeck — unique offline To‑Do app (localStorage). No frameworks.
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  tasks: load() || [],
  filter: "all",
  query: ""
};

const todoList = $("#todoList");
const doneList = $("#doneList");

function uid(){ return Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-4); }
function save(){ localStorage.setItem("focusdeck", JSON.stringify(state.tasks)); }
function load(){ try { return JSON.parse(localStorage.getItem("focusdeck") || "[]"); } catch { return []; } }

function render(){
  const now = new Date();
  const q = state.query.toLowerCase();
  const filter = state.filter;
  const items = state.tasks.filter(t => {
    const matchesQ = (t.title + " " + (t.tags||[]).join(" ")).toLowerCase().includes(q);
    if(!matchesQ) return false;
    if(filter === "done") return t.done;
    if(filter === "high") return !t.done && t.priority === "high";
    if(filter === "today"){
      if(!t.due || t.done) return false;
      const d = new Date(t.due);
      return d.toDateString() === now.toDateString();
    }
    if(filter === "overdue"){
      if(!t.due || t.done) return false;
      const d = new Date(t.due);
      return d < new Date(now.toDateString());
    }
    return !t.done;
  });

  // split
  const active = items.filter(t => !t.done);
  const done = state.tasks.filter(t => t.done && (q ? (t.title + " " + (t.tags||[]).join(" ")).toLowerCase().includes(q) : filter === "done" || filter==="all"));

  todoList.innerHTML = "";
  doneList.innerHTML = "";

  active.forEach(t => todoList.appendChild(renderItem(t)));
  done.forEach(t => doneList.appendChild(renderItem(t)));

  enableDrag(todoList);
}

function renderItem(t){
  const li = document.createElement("li");
  li.className = "item";
  li.draggable = true;
  li.dataset.id = t.id;

  const check = document.createElement("div");
  check.className = "check" + (t.done ? " done" : "");
  check.innerHTML = t.done ? "✓" : "";
  check.addEventListener("click", () => {
    t.done = !t.done;
    save(); render();
  });

  const content = document.createElement("div");
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = t.title;
  const meta = document.createElement("div");
  meta.className = "meta";
  if(t.priority && t.priority !== "normal"){
    const b = document.createElement("span");
    b.className = "badge " + t.priority;
    b.textContent = t.priority.toUpperCase();
    meta.appendChild(b);
  }
  if(t.due){
    const d = new Date(t.due);
    const span = document.createElement("span");
    const overdue = !t.done && (d < new Date(new Date().toDateString()));
    span.textContent = "Due " + d.toLocaleDateString();
    if(overdue) span.style.color = "var(--danger)";
    meta.appendChild(span);
  }
  (t.tags||[]).forEach(tag => {
    const s = document.createElement("span");
    s.className = "tag";
    s.textContent = "#" + tag;
    s.addEventListener("click", () => {
      $("#search").value = "#" + tag;
      state.query = "#" + tag;
      render();
    });
    meta.appendChild(s);
  });
  content.appendChild(title);
  content.appendChild(meta);

  const right = document.createElement("div");
  const edit = buttonIcon("✎", "Edit", () => editItem(t));
  const del = buttonIcon("🗑", "Delete", () => { 
    state.tasks = state.tasks.filter(x => x.id !== t.id);
    save(); render();
  });
  right.appendChild(edit); right.appendChild(del);

  li.appendChild(check);
  li.appendChild(content);
  li.appendChild(right);
  return li;
}

function buttonIcon(text, title, onClick){
  const b = document.createElement("button");
  b.className = "btn-icon";
  b.title = title;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function addTaskFromInputs(){
  const title = $("#taskTitle").value.trim();
  if(!title) return;
  const priority = $("#priority").value;
  const due = $("#due").value || null;
  const tags = $("#tags").value.split(",").map(s => s.trim()).filter(Boolean);
  const t = { id: uid(), title, done:false, priority, due, tags };
  state.tasks.unshift(t);
  save();
  $("#taskTitle").value = ""; $("#tags").value = ""; // keep due & priority
  render();
}

function editItem(t){
  const newTitle = prompt("Edit title:", t.title);
  if(newTitle == null) return;
  t.title = newTitle.trim() || t.title;
  const newDue = prompt("Edit due date (YYYY-MM-DD) or empty:", t.due || "");
  t.due = (newDue && /^\d{4}-\d{2}-\d{2}$/.test(newDue)) ? newDue : (newDue === "" ? null : t.due);
  const newPr = prompt("Priority (low|normal|high):", t.priority || "normal");
  if(["low","normal","high"].includes((newPr||"").toLowerCase())) t.priority = newPr.toLowerCase();
  save(); render();
}

function enableDrag(listEl){
  let dragItem = null;
  listEl.addEventListener("dragstart", (e) => {
    if(e.target.classList.contains("item")){
      dragItem = e.target;
      e.target.classList.add("dragging");
    }
  });
  listEl.addEventListener("dragend", (e) => {
    if(dragItem){
      dragItem.classList.remove("dragging");
      dragItem = null;
      // persist order
      const ids = $$("#todoList .item").map(li => li.dataset.id);
      state.tasks.sort((a,b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      save();
    }
  });
  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    const after = getDragAfterElement(listEl, e.clientY);
    const dragging = document.querySelector(".dragging");
    if(!dragging) return;
    if(after == null) listEl.appendChild(dragging);
    else listEl.insertBefore(dragging, after);
  });
}

function getDragAfterElement(container, y){
  const els = [...container.querySelectorAll(".item:not(.dragging)")];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if(offset < 0 && offset > closest.offset){
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// event bindings
$("#addBtn").addEventListener("click", addTaskFromInputs);
$("#taskTitle").addEventListener("keydown", (e) => { if(e.key === "Enter") addTaskFromInputs(); });
$("#search").addEventListener("input", (e) => {
  const v = e.target.value.trim();
  state.query = v.startsWith("#") ? v.toLowerCase() : v;
  render();
});
document.addEventListener("keydown", (e) => {
  if(e.ctrlKey && e.key.toLowerCase() === "k"){
    e.preventDefault();
    $("#search").focus();
  }
});

// filter pills
$$(".pill").forEach(p => p.addEventListener("click", () => {
  $$(".pill").forEach(x => x.classList.remove("active"));
  p.classList.add("active");
  state.filter = p.dataset.filter;
  render();
}));

// export / import
$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.tasks, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "focusdeck-tasks.json"; a.click();
  URL.revokeObjectURL(url);
});
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try{
      const arr = JSON.parse(rd.result);
      if(Array.isArray(arr)){
        state.tasks = arr.map(x => ({
          id: x.id || uid(),
          title: String(x.title || "").slice(0,200),
          done: !!x.done,
          priority: ["low","normal","high"].includes(x.priority) ? x.priority : "normal",
          due: x.due || null,
          tags: Array.isArray(x.tags) ? x.tags.filter(Boolean).slice(0,8) : []
        }));
        save(); render();
      }
    }catch(_){ alert("Invalid JSON"); }
  };
  rd.readAsText(f);
});

// initial demo data (only first run)
if(state.tasks.length === 0){
  state.tasks = [
    {id:uid(), title:"Set up portfolio on GitHub Pages", done:false, priority:"high", due:null, tags:["portfolio","cv"]},
    {id:uid(), title:"Build unique Weather App", done:true, priority:"normal", due:null, tags:["project"]},
    {id:uid(), title:"Study data structures 30 min", done:false, priority:"low", due:new Date().toISOString().slice(0,10), tags:["study"]}
  ];
  save();
}
render();

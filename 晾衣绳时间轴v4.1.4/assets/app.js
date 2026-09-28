let tasks = JSON.parse(localStorage.getItem('timelineTasksV4')) || [];
        tasks.forEach(t => {
            if (typeof t.tracking === 'undefined') t.tracking = false;
            if (!Array.isArray(t.milestones)) t.milestones = [];
            if (typeof t.category === 'undefined') t.category = '';
        });
        const colorPalette = ['#FFB300', '#E53935', '#8E24AA', '#3949AB', '#00ACC1', '#43A047', '#F4511E', '#D81B60'];
        const DAY_MS = 24 * 60 * 60 * 1000;
        let reminderQueue = [];
        let pendingImportData = null;
        let timelineFilter = 'all';
        let ddlFilter = 'all';

        function getMidnightTime(timestamp) {
            const d = new Date(timestamp);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }

        function computeMilestones(startDate, endDate) {
            const duration = Math.round((endDate - startDate) / DAY_MS);
            return [30, 60, 90].map(pct => ({
                pct: pct,
                date: getMidnightTime(startDate + Math.round(duration * pct / 100) * DAY_MS),
                status: 'pending' // pending / done / behind / postponed
            }));
        }

        function addTask() {
            const nameInput = document.getElementById('taskName');
            const dateInput = document.getElementById('taskStartDate').value;
            const durationInput = document.getElementById('taskDuration');
            const showStart = document.getElementById('showStart').checked;
            const needsTracking = document.getElementById('needsTracking').checked;
            const category = document.getElementById('taskCategory').value;

            const name = nameInput.value.trim();
            const duration = parseInt(durationInput.value);

            if (!name || isNaN(duration) || duration < 0) {
                alert('大老板，事情名字要写，天数不能小于0哦！');
                return;
            }
            if (needsTracking && duration === 0) {
                alert('持续天数为0的话没法算进度节点哦，要么去掉进度提醒，要么填个大于0的天数～');
                return;
            }

            // 处理日期逻辑：如果选了日期就用选的，没选就用今天
            let baseDate = new Date();
            if (dateInput) {
                const parts = dateInput.split('-');
                baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
            baseDate.setHours(0, 0, 0, 0);

            const endDate = new Date(baseDate);
            endDate.setDate(baseDate.getDate() + duration);

            const startStr = (baseDate.getMonth() + 1) + '.' + baseDate.getDate();
            const endStr = (endDate.getMonth() + 1) + '.' + endDate.getDate();

            const taskColor = showStart ? colorPalette[Math.floor(Math.random() * colorPalette.length)] : '#2196F3';

            tasks.push({
                id: Date.now(),
                name: name,
                duration: duration,
                startDateStr: startStr,
                endDateStr: endStr,
                fullStartDate: baseDate.getTime(),
                fullEndDate: endDate.getTime(),
                showStart: showStart,
                color: taskColor,
                tracking: needsTracking,
                milestones: needsTracking ? computeMilestones(baseDate.getTime(), endDate.getTime()) : [],
                category: category
            });

            saveData();
            renderTimeline();
            renderDDLProgress();
            nameInput.value = '';
            durationInput.value = '';
            document.getElementById('showStart').checked = false;
            document.getElementById('needsTracking').checked = false;
            document.getElementById('taskCategory').value = '';
        }

        function deleteTask(id) {
            tasks = tasks.filter(t => t.id !== id);
            saveData();
            renderTimeline();
            renderDDLProgress();
        }

        function clearAll() {
            if(confirm('确定要把晾衣绳清空吗？')) {
                tasks = [];
                saveData();
                renderTimeline();
                renderDDLProgress();
            }
        }

        function saveData() {
            localStorage.setItem('timelineTasksV4', JSON.stringify(tasks));
        }

        function renderTimeline() {
            const container = document.getElementById('timeline');
            container.innerHTML = '';

            const filteredTasks = timelineFilter === 'all' ? tasks : tasks.filter(t => t.category === timelineFilter);
            if (filteredTasks.length === 0) {
                container.innerHTML = '<div class="empty-state"><strong>🧺 该分类下暂无任务</strong></div>';
                return;
            }

            const datesMap = {};

            filteredTasks.forEach(t => {
                const endKey = getMidnightTime(t.fullEndDate);
                if (!datesMap[endKey]) {
                    datesMap[endKey] = { dateStr: t.endDateStr, items: [] };
                }
                datesMap[endKey].items.push({
                    ...t,
                    statusText: t.duration === 0 ? '当天' : (t.showStart ? '落点' : '')
                });

                if (t.showStart && t.duration > 0) {
                    const startKey = getMidnightTime(t.fullStartDate);
                    if (!datesMap[startKey]) {
                        datesMap[startKey] = { dateStr: t.startDateStr, items: [] };
                    }
                    datesMap[startKey].items.push({
                        ...t,
                        statusText: '起始'
                    });
                }
            });

            const sortedTimestamps = Object.keys(datesMap).sort((a, b) => a - b);
            const colorMap = { green: '#43A047', yellow: '#FDD835', red: '#E53935' };

            sortedTimestamps.forEach(timestamp => {
                const dayData = datesMap[timestamp];
                const col = document.createElement('div');
                col.className = 'day-column';

                const dateLabel = document.createElement('div');
                dateLabel.className = 'date-label';
                dateLabel.innerText = dayData.dateStr;
                col.appendChild(dateLabel);

                dayData.items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'task-card';
                    card.style.borderLeft = `5px solid ${item.color}`;

                    let trackingHtml = '';
                    if (item.tracking) {
                        const statusColor = colorMap[getTaskColor(item)];
                        const expected = getExpectedPercent(item);
                        trackingHtml = `<div class="tracking-expected" style="--status-color:${statusColor};">🎯 应完成 ${expected}%</div>`;
                    }
                    const categoryIcon = item.category === 'work' ? '💻 ' : (item.category === 'life' ? '🍬 ' : '');

                    card.innerHTML = `
                        <button class="delete-btn" type="button" data-delete-id="${item.id}" aria-label="删除任务">×</button>
                        ${item.statusText ? `<span class="task-status">[${item.statusText}]</span>` : ''}
                        <strong>${categoryIcon}${item.name}</strong>
                        ${trackingHtml}
                    `;
                    col.appendChild(card);
                });

                container.appendChild(col);
            });
        }

        // ===================== DDL 进度追踪（复用同一份 tasks 数据）=====================

        function getTaskColor(task) {
            const today = getMidnightTime(Date.now());
            if (task.milestones.some(m => m.status === 'behind')) return 'red';
            if (today > task.fullEndDate) return 'red';
            const daysLeft = Math.round((task.fullEndDate - today) / DAY_MS);
            const duration = Math.max(1, task.duration);
            if (daysLeft <= 1) return 'red';
            if (daysLeft <= Math.max(2, Math.round(duration * 0.2))) return 'yellow';
            return 'green';
        }

        function getExpectedPercent(task) {
            const today = getMidnightTime(Date.now());
            const total = task.fullEndDate - task.fullStartDate;
            if (total <= 0) return 100;
            let pct = Math.round((today - task.fullStartDate) / total * 100);
            return Math.max(0, Math.min(100, pct));
        }

        function renderDDLProgress() {
            const container = document.getElementById('ddlProgressList');
            container.innerHTML = '';
            const tracked = tasks.filter(t => t.tracking && (ddlFilter === 'all' || t.category === ddlFilter));
            if (tracked.length === 0) {
                container.innerHTML = '<div class="empty-state"><strong>🎯 暂无DDL任务</strong><span>勾选“需要进度提醒”的任务，就会出现在这里。</span></div>';
                return;
            }

            const colorMap = { green: '#43A047', yellow: '#FDD835', red: '#E53935' };
            const today = getMidnightTime(Date.now());
            const sorted = [...tracked].sort((a, b) => a.fullEndDate - b.fullEndDate);

            sorted.forEach(task => {
                const color = getTaskColor(task);
                const daysLeft = Math.round((task.fullEndDate - today) / DAY_MS);
                const expected = getExpectedPercent(task);
                const daysLeftText = daysLeft >= 0 ? `还剩 ${daysLeft} 天` : `已逾期 ${Math.abs(daysLeft)} 天`;
                const categoryIcon = task.category === 'work' ? '💻 ' : (task.category === 'life' ? '🍬 ' : '');

                const milestonesHtml = task.milestones.map(m => {
                    let badge = '⬜';
                    if (m.status === 'done') badge = '✅';
                    else if (m.status === 'behind') badge = '⚠️';
                    else if (m.status === 'postponed') badge = '⏭️';
                    else if (today >= m.date) badge = '🔴';
                    return `<span class="milestone">${badge} ${m.pct}%</span>`;
                }).join('');

                const card = document.createElement('div');
                card.className = 'ddl-card';
                card.style.borderLeft = `6px solid ${colorMap[color]}`;
                card.innerHTML = `
                    <button class="delete-btn" type="button" data-delete-id="${task.id}" aria-label="删除任务">×</button>
                    <strong>${categoryIcon}${task.name}</strong>
                    <div class="ddl-meta">${daysLeftText} ・ 现在应该完成 ${expected}% 了</div>
                    <div class="milestones">${milestonesHtml}</div>
                `;
                container.appendChild(card);
            });
        }

        function checkDDLReminders() {
            const today = getMidnightTime(Date.now());
            reminderQueue = [];
            tasks.filter(t => t.tracking).forEach(task => {
                task.milestones.forEach(m => {
                    if (m.status === 'pending' && m.date <= today) {
                        reminderQueue.push({ taskId: task.id, pct: m.pct });
                    }
                });
            });
            reminderQueue.sort((a, b) => a.pct - b.pct);
            showNextReminder();
        }

        function showNextReminder() {
            const modal = document.getElementById('reminderModal');
            document.getElementById('postponeSection').style.display = 'none';
            document.getElementById('reminderActions').style.display = 'block';

            if (reminderQueue.length === 0) {
                modal.style.display = 'none';
                return;
            }
            const { taskId, pct } = reminderQueue[0];
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                reminderQueue.shift();
                showNextReminder();
                return;
            }
            document.getElementById('reminderText').innerText = `【${task.name}】现在应该完成${pct}%了，进度如何？`;
            modal.dataset.taskId = taskId;
            modal.dataset.pct = pct;
            modal.style.display = 'flex';
        }

        function resolveReminder(action) {
            const modal = document.getElementById('reminderModal');
            const taskId = Number(modal.dataset.taskId);
            const pct = Number(modal.dataset.pct);
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                const milestone = task.milestones.find(m => m.pct === pct);
                if (milestone) {
                    if (action === 'done') milestone.status = 'done';
                    else if (action === 'behind') milestone.status = 'behind';
                }
            }
            saveData();
            reminderQueue.shift();
            showNextReminder();
            renderTimeline();
            renderDDLProgress();
        }

        function showPostponeInput() {
            document.getElementById('reminderActions').style.display = 'none';
            document.getElementById('postponeSection').style.display = 'block';
        }

        function cancelPostpone() {
            document.getElementById('postponeSection').style.display = 'none';
            document.getElementById('reminderActions').style.display = 'block';
        }

        function confirmPostpone() {
            const val = document.getElementById('newDeadlineInput').value;
            if (!val) {
                alert('请选择新的截止日期');
                return;
            }
            const modal = document.getElementById('reminderModal');
            const taskId = Number(modal.dataset.taskId);
            const pct = Number(modal.dataset.pct);
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            const parts = val.split('-');
            const newEnd = new Date(parts[0], parts[1] - 1, parts[2]);
            newEnd.setHours(0, 0, 0, 0);

            if (newEnd.getTime() <= task.fullStartDate) {
                alert('新的截止日期要晚于起始日期哦，本次推迟未生效');
                return;
            }

            task.fullEndDate = newEnd.getTime();
            task.duration = Math.round((task.fullEndDate - task.fullStartDate) / DAY_MS);
            task.endDateStr = (newEnd.getMonth() + 1) + '.' + newEnd.getDate();

            const milestone = task.milestones.find(m => m.pct === pct);
            if (milestone) milestone.status = 'postponed';

            task.milestones.forEach(m => {
                if (m.status === 'pending') {
                    m.date = getMidnightTime(task.fullStartDate + Math.round(task.duration * m.pct / 100) * DAY_MS);
                }
            });

            saveData();
            document.getElementById('newDeadlineInput').value = '';
            reminderQueue.shift();
            showNextReminder();
            renderTimeline();
            renderDDLProgress();
        }

        // ===================== 标签页切换 =====================
        function switchTab(tab) {
            const timelinePanel = document.getElementById('tabTimeline');
            const ddlPanel = document.getElementById('tabDDL');
            timelinePanel.classList.toggle('is-hidden', tab !== 'timeline');
            ddlPanel.classList.toggle('is-hidden', tab !== 'ddl');
            document.getElementById('tabBtnTimeline').classList.toggle('active', tab === 'timeline');
            document.getElementById('tabBtnDDL').classList.toggle('active', tab === 'ddl');

            // 每次进入 DDL 页面都从当前 tasks 重新渲染，避免切换 Tab 时显示旧的空状态。
            if (tab === 'ddl') {
                renderDDLProgress();
            }
        }

        // ===================== 分类筛选 =====================
        function updateFilterButtons(barId, filter) {
            document.getElementById(barId).querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filter);
            });
        }

        function setTimelineFilter(filter) {
            timelineFilter = filter;
            updateFilterButtons('timelineFilterBar', filter);
            renderTimeline();
        }

        function setDDLFilter(filter) {
            ddlFilter = filter;
            updateFilterButtons('ddlFilterBar', filter);
            renderDDLProgress();
        }

        // ===================== 导入 / 导出 JSON =====================
        function exportData() {
            const dataStr = JSON.stringify(tasks, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const today = new Date();
            const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            const a = document.createElement('a');
            a.href = url;
            a.download = `晾衣绳时间轴备份_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function normalizeImportedTask(t, regenId) {
            const fallbackId = Date.now() + Math.floor(Math.random() * 100000);
            return {
                id: regenId ? fallbackId : (t.id || fallbackId),
                name: t.name || '未命名任务',
                duration: typeof t.duration === 'number' ? t.duration : 0,
                startDateStr: t.startDateStr || '',
                endDateStr: t.endDateStr || '',
                fullStartDate: t.fullStartDate || Date.now(),
                fullEndDate: t.fullEndDate || Date.now(),
                showStart: !!t.showStart,
                color: t.color || '#2196F3',
                tracking: !!t.tracking,
                milestones: Array.isArray(t.milestones) ? t.milestones : [],
                category: t.category || ''
            };
        }

        function handleImportFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (!Array.isArray(parsed)) {
                        alert('这个文件格式不对，导入失败');
                        return;
                    }
                    if (tasks.length === 0) {
                        tasks = parsed.map(t => normalizeImportedTask(t, false));
                        saveData();
                        renderTimeline();
                        renderDDLProgress();
                        alert('导入成功！');
                    } else {
                        pendingImportData = parsed;
                        document.getElementById('importModal').style.display = 'flex';
                    }
                } catch (err) {
                    alert('文件解析失败，确认一下是不是导出的json文件');
                }
                event.target.value = '';
            };
            reader.readAsText(file);
        }

        function confirmImport(mode) {
            if (!pendingImportData) return;
            if (mode === 'overwrite') {
                tasks = pendingImportData.map(t => normalizeImportedTask(t, false));
            } else if (mode === 'merge') {
                const importedTasks = pendingImportData.map(t => normalizeImportedTask(t, true));
                tasks = tasks.concat(importedTasks);
            }
            saveData();
            renderTimeline();
            renderDDLProgress();
            pendingImportData = null;
            document.getElementById('importModal').style.display = 'none';
            alert('导入完成！');
        }

        function cancelImport() {
            pendingImportData = null;
            document.getElementById('importModal').style.display = 'none';
        }

        function initializeApp() {
            renderTimeline();
            renderDDLProgress();
            checkDDLReminders();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
        } else {
            initializeApp();
        }

        window.addEventListener('load', initializeApp, { once: true });
        window.addEventListener('pageshow', function () {
            renderTimeline();
            renderDDLProgress();
        });


// ===================== 事件绑定（外置 JS 版） =====================
document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-action], [data-tab], [data-filter], [data-import-mode], [data-reminder-action], [data-delete-id]');
    if (!target) return;

    if (target.dataset.deleteId) {
        deleteTask(Number(target.dataset.deleteId));
        return;
    }
    if (target.dataset.tab) {
        switchTab(target.dataset.tab);
        return;
    }
    if (target.dataset.filter && target.dataset.filterGroup === 'timeline') {
        setTimelineFilter(target.dataset.filter);
        return;
    }
    if (target.dataset.filter && target.dataset.filterGroup === 'ddl') {
        setDDLFilter(target.dataset.filter);
        return;
    }
    if (target.dataset.importMode) {
        confirmImport(target.dataset.importMode);
        return;
    }
    if (target.dataset.reminderAction) {
        resolveReminder(target.dataset.reminderAction);
        return;
    }
    switch (target.dataset.action) {
        case 'export': exportData(); break;
        case 'open-import': document.getElementById('importFileInput').click(); break;
        case 'add-task': addTask(); break;
        case 'clear-all': clearAll(); break;
        case 'cancel-import': cancelImport(); break;
        case 'show-postpone': showPostponeInput(); break;
        case 'confirm-postpone': confirmPostpone(); break;
        case 'cancel-postpone': cancelPostpone(); break;
    }
});

document.getElementById('importFileInput').addEventListener('change', handleImportFile);

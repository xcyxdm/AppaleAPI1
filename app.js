document.addEventListener('DOMContentLoaded', () => {
    const dateDisplay = document.getElementById('current-date');
    const memoInput = document.getElementById('memo-input');
    const saveBtn = document.getElementById('save-btn');
    const memoList = document.getElementById('memo-list');

    // Calendar Elements
    const calendarMonth = document.getElementById('calendar-month');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // File System Elements
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const folderStatus = document.getElementById('folder-status');

    let dirHandle = null;

    // --- DB Utils for Directory Handle Persistence ---
    const DB_NAME = 'DailyMemoDB';
    const STORE_NAME = 'settings';

    const openDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    const saveHandle = async (handle) => {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, 'dirHandle');
        return tx.complete;
    };

    const getHandle = async () => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get('dirHandle');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    // --- Core Logic ---

    // Utility: Format Date YYYY-MM-DD
    const formatDateKey = (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Utility: Format Date for Display
    const updateHeaderDate = (date) => {
        dateDisplay.textContent = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    };

    // Current State
    let selectedDate = new Date();
    let currentViewDate = new Date();
    let memoCache = new Set(); // Stores keys "YYYY-MM-DD" that have files

    // Init UI
    updateHeaderDate(selectedDate);

    // --- File Operations ---

    // Verify permission
    const verifyPermission = async (handle, readWrite) => {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    };

    // Initialize Folder (Load from DB or Wait for User)
    const initFolder = async () => {
        try {
            const handle = await getHandle();
            if (handle) {
                dirHandle = handle;
                folderStatus.textContent = `フォルダ: ${dirHandle.name} (再認証が必要な場合があります)`;
                // Attempt to read directory to trigger permission prompt early if needed, or wait for specific action
                // For better UX, we might ask right away or wait for first read
                await scanDirectory(); // This might trigger prompt
                loadMemo(); // and this
            } else {
                folderStatus.textContent = 'フォルダ: 未選択';
                alert('最初に「フォルダ選択」ボタンから、メモを保存するフォルダを選択してください。');
            }
        } catch (err) {
            console.error('Init folder error:', err);
            folderStatus.textContent = 'フォルダ: エラー';
        }
    };

    // Select Folder Action
    selectFolderBtn.addEventListener('click', async () => {
        try {
            dirHandle = await window.showDirectoryPicker();
            folderStatus.textContent = `フォルダ: ${dirHandle.name}`;
            await saveHandle(dirHandle);
            await scanDirectory();
            loadMemo();
        } catch (err) {
            console.error('Folder selection cancelled or failed', err);
        }
    });

    // Scan Directory for .txt files
    const scanDirectory = async () => {
        if (!dirHandle) return;

        // Verify permission for listing
        if (!await verifyPermission(dirHandle, false)) return;

        memoCache.clear();
        memoList.innerHTML = '';
        const historyItems = [];

        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
                    const dateKey = entry.name.replace('.txt', '');
                    // Basic validation of dateKey format YYYY-MM-DD if needed
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                        memoCache.add(dateKey);

                        // For history list, we might want to peek content? expensive...
                        // Let's just list the dates for now or Lazy load content?
                        // Implementing full history list with content preview:
                        const file = await entry.getFile();
                        const text = await file.text();
                        historyItems.push({ date: dateKey, content: text });
                    }
                }
            }

            // Sort and Render History
            historyItems.sort((a, b) => b.date.localeCompare(a.date));
            renderHistory(historyItems);
            renderCalendar();

        } catch (err) {
            console.error('Scan error:', err);
            // alert('フォルダの読み込みに失敗しました');
        }
    };

    // Load Memo for Selected Date
    const loadMemo = async () => {
        memoInput.value = ''; // Reset first
        updateHeaderDate(selectedDate);

        if (!dirHandle) return;

        const key = formatDateKey(selectedDate);
        const filename = `${key}.txt`;

        try {
            // Check if file exists in cache/dir first to avoid error? 
            // getFileHandle throws if not found
            const fileHandle = await dirHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            const text = await file.text();
            memoInput.value = text;
        } catch (err) {
            if (err.name === 'NotFoundError') {
                // No memo for this day, empty is correct
            } else {
                console.error('Load Error:', err);
            }
        }
    };

    // Save Memo
    const saveMemo = async () => {
        if (!dirHandle) {
            alert('フォルダを選択してください');
            return;
        }

        // Verify RW permission
        if (!await verifyPermission(dirHandle, true)) return;

        const key = formatDateKey(selectedDate);
        const filename = `${key}.txt`;
        const content = memoInput.value.trim();

        try {
            if (content) {
                const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                alert('保存しました');
            } else {
                // If empty, delete file?
                try {
                    await dirHandle.removeEntry(filename);
                    alert('削除しました');
                } catch (e) {
                    // ignore if not found
                }
            }
            // Refresh
            await scanDirectory();
        } catch (err) {
            console.error('Save failed:', err);
            alert('保存に失敗しました: ' + err.message);
        }
    };

    // --- Rendering ---

    const renderCalendar = () => {
        const year = currentViewDate.getFullYear();
        const month = currentViewDate.getMonth();

        calendarMonth.textContent = `${year}年 ${month + 1}月`;
        calendarGrid.innerHTML = '';

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const startingDay = firstDay.getDay();
        const totalDays = lastDay.getDate();

        for (let i = 0; i < startingDay; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            calendarGrid.appendChild(div);
        }

        const todayKey = formatDateKey(new Date());
        const selectedKey = formatDateKey(selectedDate);

        for (let day = 1; day <= totalDays; day++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = day;

            const currentDayDate = new Date(year, month, day);
            const currentDayKey = formatDateKey(currentDayDate);

            if (currentDayKey === todayKey) div.classList.add('today');
            if (currentDayKey === selectedKey) div.classList.add('selected');
            if (memoCache.has(currentDayKey)) div.classList.add('has-memo');

            div.addEventListener('click', () => {
                selectedDate = currentDayDate;
                loadMemo();
                renderCalendar();
            });

            calendarGrid.appendChild(div);
        }
    };

    const renderHistory = (items) => {
        memoList.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'memo-item';

            const dateDiv = document.createElement('div');
            dateDiv.className = 'memo-date';
            dateDiv.textContent = item.date;

            const previewDiv = document.createElement('div');
            previewDiv.className = 'memo-preview';
            previewDiv.textContent = item.content;

            li.appendChild(dateDiv);
            li.appendChild(previewDiv);

            li.addEventListener('click', () => {
                selectedDate = new Date(item.date);
                currentViewDate = new Date(selectedDate);
                loadMemo();
                renderCalendar();
                // window.scrollTo({ top: 0, behavior: 'smooth' }); // in 3-col we generally don't scroll the body
            });

            memoList.appendChild(li);
        });
    };

    // Events
    saveBtn.addEventListener('click', saveMemo);

    prevMonthBtn.addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        renderCalendar();
    });

    // Register SW
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.error('SW failed', err));
    }

    // Start
    initFolder();
    // Initial Render (Empty state until folder/scan)
    renderCalendar();
});

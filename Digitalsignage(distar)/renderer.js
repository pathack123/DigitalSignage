document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const controls = {
    mediaButton: document.getElementById('mediaButton'),
    resolutionSelect: document.getElementById('resolutionSelect'),
    fileInput: document.getElementById('fileInput'),
    timeline: document.getElementById('timeline'),
    playButton: document.getElementById('playButton'),
    pauseButton: document.getElementById('pauseButton'),
    rewindButton: document.getElementById('rewindButton'),
    currentResolution: document.getElementById('currentResolution'),
    // Content Properties Panel
    positionX: document.getElementById('positionX'),
    positionY: document.getElementById('positionY'),
    widthInput: document.getElementById('width'),
    heightInput: document.getElementById('height'),
    opacityInput: document.getElementById('opacity'),
    // Zoom Control
    zoomSelect: document.getElementById('zoomSelect'),
    // Custom Resolution Controls
    customResolutionModal: new bootstrap.Modal(document.getElementById('customResolutionModal'), {
      keyboard: false
    }),
    customWidth: document.getElementById('customWidth'),
    customHeight: document.getElementById('customHeight'),
    confirmCustomResolution: document.getElementById('confirmCustomResolution'),
    // Import Media Modal (Timeline)
    importMediaModal: new bootstrap.Modal(document.getElementById('importMediaModal'), {
      keyboard: false
    }),
    timelineFileInput: document.getElementById('timelineFileInput'),
    confirmTimelineImport: document.getElementById('confirmTimelineImport'),
  };

  let mediaItems = [];
  let selectedMedia = null, isResizing = false, isDragging = false, isPaused = true;
  let dragOffsetX = 0, dragOffsetY = 0;
  let currentMediaItemId = null; // สำหรับการเชื่อมโยง Timeline Item กับ Media

  // ขนาดจริงของ canvas
  let canvasRealWidth = 1920;
  let canvasRealHeight = 1080;

  // Zoom Factor
  let zoomFactor = 1; // เริ่มต้นที่ 100%

  // ฟังก์ชันในการปรับขนาดของ Canvas
  const resizeCanvas = (width, height) => {
    canvasRealWidth = width;
    canvasRealHeight = height;
    canvas.width = width;
    canvas.height = height;
    redrawCanvas();
    controls.currentResolution.textContent = `${controls.resolutionSelect.value === 'custom' ? 'Custom' : controls.resolutionSelect.value} (${width}x${height} px)`;
  };

  // ฟังก์ชันในการปรับ Zoom
  const setZoom = (factor) => {
    zoomFactor = factor;
    canvas.style.transform = `scale(${zoomFactor})`;
    // อัพเดตข้อความแสดง Zoom ใน Timeline Header
    const zoomText = document.querySelector('.timeline-header span:nth-child(3)');
    if (zoomText) {
      zoomText.textContent = `Zoom: ${Math.round(zoomFactor * 100)}%`;
    }
    redrawCanvas();
  };

  const redrawCanvas = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset any existing transformations
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // วาด media items ที่ยังไม่ได้ถูกลบ
    mediaItems.forEach(item => {
      if (!item.removed) { 
        if (item.type === 'video' || item.type === 'image') {
          // ตั้งค่าความโปร่งใส
          ctx.globalAlpha = item.opacity;

          if (item.type === 'video') {
            // วาดวิดีโอถ้าวิดีโอพร้อมเล่น
            if (item.media.readyState >= 2) { // ตรวจสอบว่าวิดีโอพร้อมเล่น
              ctx.drawImage(
                item.media, 
                item.x, item.y, 
                item.width, item.height
              );
            }
          } else if (item.type === 'image') {
            // วาดรูปภาพถ้ามีการโหลดเสร็จสิ้น
            if (item.media.complete) {
              ctx.drawImage(
                item.media,
                item.x, item.y,
                item.width, item.height
              );
            }
          }

          // รีเซ็ตความโปร่งใส
          ctx.globalAlpha = 1.0;

          // วาดกรอบรอบๆ วิดีโอหรือรูปภาพ
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            item.x, item.y, 
            item.width, item.height
          );
        } else if (item.type === null) { // สำหรับ 'Media Empty' items
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            item.x, item.y, 
            item.width, item.height
          );
        }
      }
    });

    if (!isPaused) requestAnimationFrame(redrawCanvas);
  };

  const addMediaToTimeline = (mediaItem) => {
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item d-flex justify-content-between align-items-center p-2 border mb-1';
    timelineItem.dataset.id = mediaItem.id; // เก็บ ID เพื่อเชื่อมโยงกับ Media Item
    timelineItem.innerHTML = `
      <span style="flex-grow: 1; text-align: center;">${mediaItem.fileName || 'Media Empty'}</span>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-success add-media">+</button>
        <button class="btn btn-sm btn-danger delete">Delete</button>
      </div>
    `;
    timelineItem.querySelector('.add-media').addEventListener('click', () => {
      currentMediaItemId = mediaItem.id;
      controls.importMediaModal.show();
    });

    timelineItem.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      console.log(`Delete button clicked for mediaItem ID: ${mediaItem.id}`);
      removeMediaItem(mediaItem, timelineItem);
    });

    // Optionally, add event listener to select media when clicking on the item itself (excluding buttons)
    timelineItem.addEventListener('click', (e) => {
      if (!e.target.classList.contains('add-media') && !e.target.classList.contains('delete')) {
        selectMedia(mediaItem, timelineItem);
      }
    });

    controls.timeline.appendChild(timelineItem);
  };

  const selectMedia = (mediaItem, timelineItem) => {
    selectedMedia = mediaItem;
    document.querySelectorAll('.timeline-item').forEach(item => item.classList.remove('selected'));
    timelineItem.classList.add('selected');

    // แสดงค่าของ mediaItem ใน Content Properties Panel
    populatePropertiesPanel(mediaItem);
  };

  const populatePropertiesPanel = (mediaItem) => {
    if (!mediaItem || mediaItem.type === null) return;

    controls.positionX.value = Math.round(mediaItem.x);
    controls.positionY.value = Math.round(mediaItem.y);
    controls.widthInput.value = Math.round(mediaItem.width);
    controls.heightInput.value = Math.round(mediaItem.height);
    controls.opacityInput.value = Math.round(mediaItem.opacity * 100);
  };

  const addMediaItem = (type, media, fileName) => {
    // หยุดการเล่นสื่อทั้งหมดเมื่อมีการเพิ่ม media ใหม่
    if (!isPaused) {
      mediaItems.forEach(item => {
        if ((item.type === 'video' || item.type === 'image') && !item.removed) {
          item.media.pause();
        }
      });
      isPaused = true;
    }

    const id = Date.now(); // สร้าง ID สำหรับ Media Item

    if (!mediaItems.some(item => item.fileName === fileName && item.id === id)) {
      const newItem = { 
        id, // เพิ่ม ID
        type, 
        media, 
        fileName, 
        x: 100, // ตำแหน่งเริ่มต้น
        y: 100, 
        width: 480, // ตัวอย่างขนาด 25% ของ 1920x1080
        height: 270, 
        removed: false, 
        opacity: 1, // เพิ่ม opacity
        isFullscreen: false,
        originalX: 0,
        originalY: 0,
        originalWidth: 0,
        originalHeight: 0
      };
      mediaItems.push(newItem);
      addMediaToTimeline(newItem);
      redrawCanvas();
      console.log(`Added mediaItem: ${fileName} with ID: ${id}`);
    }
  };

  const removeMediaItem = (mediaItem, timelineItem) => {
    console.log(`removeMediaItem called for mediaItem ID: ${mediaItem.id}`);
    // แยกการจัดการสำหรับ video และ image
    if (mediaItem.type === 'video') {
      // สำหรับวิดีโอ: หยุดการเล่นและรีเซ็ต src
      if (mediaItem.media) {
        mediaItem.media.pause();
        mediaItem.media.src = "";
        mediaItem.media.load();
        console.log(`Video mediaItem ID: ${mediaItem.id} paused and src reset`);
      }
    } else if (mediaItem.type === 'image') {
      // สำหรับรูปภาพ: รีเซ็ต src
      if (mediaItem.media) {
        mediaItem.media.src = "";
        console.log(`Image mediaItem ID: ${mediaItem.id} src reset`);
      }
    }

    // ทำเครื่องหมายว่า media นี้ถูกลบ
    mediaItem.removed = true;

    // ลบออกจาก mediaItems
    mediaItems = mediaItems.filter(item => !item.removed);
    console.log(`mediaItems after removal: `, mediaItems);

    // ลบ Timeline item
    if (timelineItem && timelineItem.parentNode) {
      controls.timeline.removeChild(timelineItem);
      console.log(`Removed timelineItem for mediaItem ID: ${mediaItem.id}`);
    }

    // หากลบ mediaItem ที่ถูกเลือก, รีเซ็ต selectedMedia
    if (selectedMedia && selectedMedia.id === mediaItem.id) {
      selectedMedia = null;
      // Clear properties panel
      controls.positionX.value = '';
      controls.positionY.value = '';
      controls.widthInput.value = '';
      controls.heightInput.value = '';
      controls.opacityInput.value = 100;
      console.log(`Reset selectedMedia`);
    }

    redrawCanvas();
  };

  const handleResolutionChange = () => {
    const selectedValue = controls.resolutionSelect.value;
    let width, height;

    if (selectedValue === '16:9') {
      width = 1920;
      height = 1080;
    } else if (selectedValue === '4:3') {
      width = 1024;
      height = 768;
    } else if (selectedValue === '1:1') {
      width = 1080;
      height = 1080;
    } else if (selectedValue === '16:10') {
      width = 1920;
      height = 1200;
    } else if (selectedValue === 'custom') {
      // เปิด Modal สำหรับ Custom Resolution
      controls.customResolutionModal.show();
      return; // ออกจากฟังก์ชันก่อน เพื่อรอการกรอกค่า Custom
    }

    resizeCanvas(width, height);

    // รีเฟรชค่าของ Content Properties Panel
    if (selectedMedia) {
      populatePropertiesPanel(selectedMedia);
    }
  };

  const applyCustomResolution = () => {
    const customWidth = parseInt(controls.customWidth.value, 10);
    const customHeight = parseInt(controls.customHeight.value, 10);

    if (isNaN(customWidth) || isNaN(customHeight) || customWidth <= 0 || customHeight <= 0) {
      alert('กรุณากรอกค่าความกว้างและความสูงที่ถูกต้อง');
      return;
    }

    resizeCanvas(customWidth, customHeight);

    // ซ่อน Modal หลังจากปรับขนาดเรียบร้อยแล้ว
    controls.customResolutionModal.hide();

    // รีเซ็ตค่าของ Select Box เป็น Custom พร้อมแสดงข้อความความละเอียด
    controls.currentResolution.textContent = `Custom (${customWidth}x${customHeight} px)`;

    // รีเฟรชค่าของ Content Properties Panel
    if (selectedMedia) {
      populatePropertiesPanel(selectedMedia);
    }
  };

  const importMedia = (event) => {
    Array.from(event.target.files).forEach(file => {
      if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = e.target.result;
            video.muted = true;
            video.loop = true;
            video.crossOrigin = "anonymous"; // ป้องกันปัญหา CORS
            video.addEventListener('canplay', () => {
              addMediaItem('video', video, file.name);
              console.log(`Video loaded: ${file.name}`);
            });

            // หยุดการเล่นวิดีโอเริ่มต้น
            video.pause();
          } else if (file.type.startsWith('image/')) {
            const img = new Image();
            img.src = e.target.result;
            img.addEventListener('load', () => {
              addMediaItem('image', img, file.name);
              console.log(`Image loaded: ${file.name}`);
            });
          }
        };
        reader.readAsDataURL(file);
      }
    });
    controls.fileInput.value = '';
  };

  // ฟังก์ชันสำหรับการนำเข้าสื่อผ่าน Timeline Item
  const handleTimelineImport = () => {
    const file = controls.timelineFileInput.files[0];
    if (!file) {
      alert('กรุณาเลือกไฟล์สื่อที่ต้องการนำเข้า');
      return;
    }

    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      alert('รองรับเฉพาะไฟล์วิดีโอ (.mp4, .avi) และรูปภาพ (.jpg, .png)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = e.target.result;
        video.muted = true;
        video.loop = true;
        video.crossOrigin = "anonymous"; // ป้องกันปัญหา CORS
        video.addEventListener('canplay', () => {
          const mediaItem = mediaItems.find(item => item.id === currentMediaItemId);
          if (mediaItem) {
            mediaItem.type = 'video';
            mediaItem.media = video;
            mediaItem.fileName = file.name;
            populatePropertiesPanel(mediaItem);
            redrawCanvas();
            updateTimelineItemName(mediaItem.id, file.name);
            console.log(`Video imported: ${file.name}`);
          }
        });

        // หยุดการเล่นวิดีโอเริ่มต้น
        video.pause();
      } else if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = e.target.result;
        img.addEventListener('load', () => {
          const mediaItem = mediaItems.find(item => item.id === currentMediaItemId);
          if (mediaItem) {
            mediaItem.type = 'image';
            mediaItem.media = img;
            mediaItem.fileName = file.name;
            populatePropertiesPanel(mediaItem);
            redrawCanvas();
            updateTimelineItemName(mediaItem.id, file.name);
            console.log(`Image imported: ${file.name}`);
          }
        });
      }
    };
    reader.readAsDataURL(file);

    // ซ่อน Modal หลังจากเลือกไฟล์แล้ว
    controls.importMediaModal.hide();
  };

  // ฟังก์ชันในการอัพเดตชื่อของ Timeline Item หลังจากนำเข้าสื่อ
  const updateTimelineItemName = (id, newName) => {
    const timelineItem = document.querySelector(`.timeline-item[data-id="${id}"] span`);
    if (timelineItem) {
      timelineItem.textContent = newName;
      console.log(`Timeline item name updated for ID: ${id} to ${newName}`);
    }

    // วาดหรืออัพเดตกรอบสีแดงบน Canvas Area ถ้าจำเป็น
    redrawCanvas();
  };

  // ฟังก์ชันในการจัดการ Mouse Actions
  const handleMouseActions = (e, type) => {
    if (type === 'up') {
      isDragging = isResizing = false;

      if (selectedMedia && (selectedMedia.type === 'video' || selectedMedia.type === 'image') && !isPaused && selectedMedia.media) {
        selectedMedia.media.play();
        console.log(`Playing mediaItem ID: ${selectedMedia.id}`);
      }
      return; // ออกจากฟังก์ชันหลังจากจัดการ 'up'
    }

    if (!e) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoomFactor;
    const mouseY = (e.clientY - rect.top) / zoomFactor;

    if (type === 'down') {
      selectedMedia = mediaItems.find(item => 
        mouseX >= item.x && mouseX <= item.x + item.width &&
        mouseY >= item.y && mouseY <= item.y + item.height
      );
      console.log(`Mouse down on mediaItem: `, selectedMedia);

      if (selectedMedia) {
        isResizing = (mouseX >= selectedMedia.x + selectedMedia.width - 10) &&
                     (mouseY >= selectedMedia.y + selectedMedia.height - 10);
        if (!isResizing) {
          isDragging = true;
          dragOffsetX = mouseX - selectedMedia.x;
          dragOffsetY = mouseY - selectedMedia.y;
          console.log(`Dragging started for mediaItem ID: ${selectedMedia.id}`);
        } else {
          console.log(`Resizing started for mediaItem ID: ${selectedMedia.id}`);
        }

        // ตรวจสอบว่ามี media อยู่จริงก่อนที่จะพยายาม pause
        if (selectedMedia.media && (selectedMedia.type === 'video' || selectedMedia.type === 'image')) {
          selectedMedia.media.pause();
          console.log(`Paused mediaItem ID: ${selectedMedia.id}`);
        }

        populatePropertiesPanel(selectedMedia);
      }
    } else if (type === 'move' && (isDragging || isResizing)) {
      if (selectedMedia) {
        if (isDragging) {
          selectedMedia.x = Math.max(0, Math.min(mouseX - dragOffsetX, canvasRealWidth - selectedMedia.width));
          selectedMedia.y = Math.max(0, Math.min(mouseY - dragOffsetY, canvasRealHeight - selectedMedia.height));
          console.log(`Dragging mediaItem ID: ${selectedMedia.id}, New Position: (${selectedMedia.x}, ${selectedMedia.y})`);
        } else if (isResizing) {
          selectedMedia.width = Math.max(10, Math.min(mouseX - selectedMedia.x, canvasRealWidth - selectedMedia.x));
          selectedMedia.height = Math.max(10, Math.min(mouseY - selectedMedia.y, canvasRealHeight - selectedMedia.y));
          console.log(`Resizing mediaItem ID: ${selectedMedia.id}, New Size: (${selectedMedia.width}, ${selectedMedia.height})`);
        }
        populatePropertiesPanel(selectedMedia);
        redrawCanvas();
      }
    }
  };

  const handlePlayControl = (action) => {
    if (action === 'rewind') {
      mediaItems.forEach(item => {
        if ((item.type === 'video' || item.type === 'image') && !item.removed) {
          if (item.type === 'video') {
            item.media.currentTime = 0;
            console.log(`Rewound video mediaItem ID: ${item.id}`);
          }
          // สำหรับภาพ ไม่จำเป็นต้องรีเซ็ตเวลา
        }
      });
    } else {
      isPaused = action === 'pause';
      mediaItems.forEach(item => {
        if ((item.type === 'video' || item.type === 'image') && !item.removed) {
          if (isPaused) {
            item.media.pause();
            console.log(`Paused mediaItem ID: ${item.id}`);
          } else {
            if (item.type === 'video') {
              item.media.play();
              console.log(`Playing mediaItem ID: ${item.id}`);
            }
            // สำหรับภาพ ไม่จำเป็นต้องเล่น
          }
        }
      });
      if (!isPaused) redrawCanvas();
    }
  };

  const handlePropertyChange = () => {
    if (!selectedMedia) return;

    let x = parseInt(controls.positionX.value, 10);
    let y = parseInt(controls.positionY.value, 10);
    let width = parseInt(controls.widthInput.value, 10);
    let height = parseInt(controls.heightInput.value, 10);

    // ตรวจสอบค่าที่ป้อนเข้ามา
    if (isNaN(x)) x = 0;
    if (isNaN(y)) y = 0;
    if (isNaN(width)) width = canvasRealWidth;
    if (isNaN(height)) height = canvasRealHeight;

    // Clamp ค่าภายในขอบเขตของ canvas
    x = Math.max(0, Math.min(x, canvasRealWidth));
    y = Math.max(0, Math.min(y, canvasRealHeight));
    width = Math.max(10, Math.min(width, canvasRealWidth - x));
    height = Math.max(10, Math.min(height, canvasRealHeight - y));

    // อัพเดตค่าลงใน mediaItem
    selectedMedia.x = x;
    selectedMedia.y = y;
    selectedMedia.width = width;
    selectedMedia.height = height;

    console.log(`Updated mediaItem ID: ${selectedMedia.id}, New Position: (${x}, ${y}), New Size: (${width}, ${height})`);
    redrawCanvas();
  };

  const handleOpacityChange = () => {
    if (!selectedMedia) return;

    let opacity = parseInt(controls.opacityInput.value, 10);
    if (isNaN(opacity)) opacity = 100;

    // Clamp opacity ระหว่าง 0 ถึง 100
    opacity = Math.max(0, Math.min(opacity, 100));
    selectedMedia.opacity = opacity / 100;

    console.log(`Updated opacity for mediaItem ID: ${selectedMedia.id} to ${opacity}%`);
    redrawCanvas();
  };

  const handleZoomChange = () => {
    const selectedZoom = parseFloat(controls.zoomSelect.value);
    setZoom(selectedZoom);
  };

  // เพิ่ม Event Listeners ให้กับฟิลด์ใน Content Properties Panel และ Zoom Control
  controls.positionX.addEventListener('input', handlePropertyChange);
  controls.positionY.addEventListener('input', handlePropertyChange);
  controls.widthInput.addEventListener('input', handlePropertyChange);
  controls.heightInput.addEventListener('input', handlePropertyChange);
  controls.opacityInput.addEventListener('input', handleOpacityChange);
  controls.zoomSelect.addEventListener('change', handleZoomChange);
  controls.resolutionSelect.addEventListener('change', handleResolutionChange);

  // เพิ่ม Event Listener สำหรับ Import Media Modal
  controls.confirmTimelineImport.addEventListener('click', handleTimelineImport);

  // การตั้งค่าเริ่มต้นและ Event Listeners อื่นๆ
  resizeCanvas(canvasRealWidth, canvasRealHeight);

  // ตั้งค่า Zoom เริ่มต้นตามค่าที่เลือกใน Zoom Select
  setZoom(parseFloat(controls.zoomSelect.value));

  // Event Listeners สำหรับ Import ผ่าน Media Button
  controls.mediaButton.addEventListener('click', () => {
    // สร้าง Timeline Item แบบ 'Media Empty'
    const id = Date.now(); // สร้าง ID
    const mediaItem = { 
      id, // ใช้ ID เดียวกันกับ Timeline Item
      type: null, // ยังไม่มีประเภท
      media: null, 
      fileName: 'Media Empty',
      x: 100, 
      y: 100, 
      width: 480, 
      height: 270, 
      removed: false, 
      opacity: 1, 
      isFullscreen: false,
      originalX: 0,
      originalY: 0,
      originalWidth: 0,
      originalHeight: 0
    };
    mediaItems.push(mediaItem);
    addMediaToTimeline(mediaItem);

    // สร้างกรอบสีแดงใน Canvas Area ทันที
    redrawCanvas();
    console.log(`Media Empty timeline item created with ID: ${id}`);
  });

  controls.fileInput.addEventListener('change', importMedia);
  canvas.addEventListener('mousedown', (e) => handleMouseActions(e, 'down'));
  canvas.addEventListener('mousemove', (e) => handleMouseActions(e, 'move'));
  document.addEventListener('mouseup', (e) => handleMouseActions(e, 'up'));

  // ดับเบิ้ลคลิกเพื่อขยายเต็มจอ
  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoomFactor;
    const mouseY = (e.clientY - rect.top) / zoomFactor;
    const mediaToExpand = mediaItems.find(item => 
      mouseX >= item.x && mouseX <= item.x + item.width &&
      mouseY >= item.y && mouseY <= item.y + item.height
    );
    if (mediaToExpand && (mediaToExpand.type === 'video' || mediaToExpand.type === 'image')) {
      // สลับ fullscreen หรือขยายเป็นเต็มจอ
      if (mediaToExpand.isFullscreen) {
        // ยกเลิก fullscreen
        mediaToExpand.x = mediaToExpand.originalX;
        mediaToExpand.y = mediaToExpand.originalY;
        mediaToExpand.width = mediaToExpand.originalWidth;
        mediaToExpand.height = mediaToExpand.originalHeight;
        mediaToExpand.isFullscreen = false;
        console.log(`Exited fullscreen for mediaItem ID: ${mediaToExpand.id}`);
      } else {
        // บันทึกตำแหน่งและขนาดเดิมก่อน
        mediaToExpand.originalX = mediaToExpand.x;
        mediaToExpand.originalY = mediaToExpand.y;
        mediaToExpand.originalWidth = mediaToExpand.width;
        mediaToExpand.originalHeight = mediaToExpand.height;
        // ขยายเป็นเต็มจอ
        mediaToExpand.x = 0;
        mediaToExpand.y = 0;
        mediaToExpand.width = canvasRealWidth;
        mediaToExpand.height = canvasRealHeight;
        mediaToExpand.isFullscreen = true;
        console.log(`Entered fullscreen for mediaItem ID: ${mediaToExpand.id}`);
      }
      populatePropertiesPanel(mediaToExpand); // อัพเดต Content Properties Panel
      redrawCanvas();
    }
  });

  controls.playButton.addEventListener('click', () => handlePlayControl('play'));
  controls.pauseButton.addEventListener('click', () => handlePlayControl('pause'));
  controls.rewindButton.addEventListener('click', () => handlePlayControl('rewind'));

  // เรียกฟังก์ชัน redrawCanvas เพื่อเริ่มต้นการวาด
  redrawCanvas();
});

define(['sugar-web/activity/activity', 'webL10n', 'activity/progress', 'activity/stopwatch'], function (activity, l10n, Progress, Stopwatch) {

  // Manipulate the DOM only when it is ready.
  require(['domReady!'], function (doc) {

    // Initialize the activity.
    activity.setup()
    const datastore = activity.getDatastoreObject()
    activity.getXOColor((err, color) => {
      window.addEventListener('localized', () => {
        main(Progress, Stopwatch, l10n, color, datastore)
      })
    })
  })
})

function convertReadableMS(timeInMs) {
  var parsedTime = parseMs(timeInMs)
  var timeStr = parsedTime.hours
    ? `${parsedTime.hours + parsedTime.days * 24}:${parsedTime.minutes}:${parsedTime.seconds}`
    : `${parsedTime.minutes}:${parsedTime.seconds}`
  return timeStr
    .split(':')
    .map((num) => `${num}`.padStart(2, '0'))
    .join(':')
}

const defaultWorkTimerLimit = 0.1
const defaultBreakTimerLimit = 0.1
function main(Progress, Stopwatch, l10n, color,datastore) {
  this.state = {
    status: 'work',
    workTimerLimit: defaultWorkTimerLimit,
    breakTimerLimit: defaultBreakTimerLimit,
    progress: 1,
    currentWorkText: convertReadableMS(defaultWorkTimerLimit * 1000 * 60),
    currentBreakText: convertReadableMS(defaultBreakTimerLimit * 1000 * 60),
    themeColor: '#FF0060',
    isButtonsDisable: false,
  }
  datastore.loadAsText((err, metadata, data) => {
    if (data) {
      this.state = stateFromLocal
    }
  })
  startWork()
  renderPomodoroText()
  renderStatusText(l10n.get(this.state.status))
  var pomodoroContainer = document.getElementById('pomodoro-container')
  this.pomodoro = new Progress(280, color.stroke, this.state.progress, pomodoroContainer)
  this.pomodoro.draw()
  renderTheme(color.stroke)
  saveInDataStore()

  function mapRange(obj, num) {
    return (((num - obj.from[0]) * (obj.to[1] - obj.to[0])) / (obj.from[1] - obj.from[0])) + obj.to[0]
  }

  function parseMs(ms) {
    if (typeof ms !== 'number') {
      throw new TypeError('Expected a number')
    }

    var roundTowardZero = ms > 0 ? Math.floor : Math.ceil

    return {
      days: roundTowardZero(ms / 86400000),
      hours: roundTowardZero(ms / 3600000) % 24,
      minutes: roundTowardZero(ms / 60000) % 60,
      seconds: roundTowardZero(ms / 1000) % 60,
      milliseconds: roundTowardZero(ms) % 1000
    }
  }

  function saveInDataStore() {
    datastore.setDataAsText({
      state: this.state
    })
    datastore.save(err => {
      if (err) {
        console.errror(err)
      }
    })
    setTimeout(saveInDataStore ,1000)
  }

  function convertReadableMS(timeInMs) {
    var parsedTime = parseMs(timeInMs)
    var timeStr = parsedTime.hours
      ? `${parsedTime.hours + parsedTime.days * 24}:${parsedTime.minutes}:${parsedTime.seconds}`
      : `${parsedTime.minutes}:${parsedTime.seconds}`
    return timeStr
      .split(':')
      .map((num) => `${num}`.padStart(2, '0'))
      .join(':')
  }


  this.handlePausePlay = function() {
    var playPauseButton = document.getElementById('play-button')
    if (this.state.status === 'work') {
      if (this.workTimer.state === 1) {
        //if timer is running
        this.workTimer.stop()
        enableButtons()
        playPauseButton.classList.remove('pause')
        playPauseButton.classList.add('play')
      } else {
        this.workTimer.start()
        disableButtons()
        playPauseButton.classList.remove('play')
        playPauseButton.classList.add('pause')
      }
    } else {
        if (this.breakTimer.state === 1) {
          this.breakTimer.stop()
          enableButtons()
          playPauseButton.classList.remove('pause')
          playPauseButton.classList.add('play')
        } else {
          disableButtons()
          this.breakTimer.start()
          playPauseButton.classList.remove('play')
          playPauseButton.classList.add('pause')
        }
    }
  }

  function startWork() {
    var timerInMS = this.state.workTimerLimit * 60 * 1000
    this.workTimer = new Stopwatch(timerInMS)
    this.state.status = 'work'
    this.workTimer.onTime((time) => {
      var progress = mapRange({
        from: [timerInMS, 0],
        to: [1, 0]
      }, time.ms)
      setProgress(progress, convertReadableMS(time.ms))
    })
    this.workTimer.onDone(() => {
      renderTheme(color.fill)
      setTimeout(() => {
        renderStatusText(l10n.get('break'))
        startBreak()
        this.breakTimer.start()
      }, 1000)
    })
  }

  function startBreak() {
    var timerInMS = this.state.breakTimerLimit * 60 * 1000
    this.breakTimer = new Stopwatch(timerInMS)
    this.state.status = 'break'
    this.breakTimer.onTime((time) => {
      var progress = mapRange({
        from: [timerInMS, 0],
        to: [1, 0]
      }, time.ms)
      setProgress(progress, convertReadableMS(time.ms))
    })
    this.breakTimer.onDone(() => {
      renderTheme(color.stroke)
      renderStatusText(l10n.get('work'))
      setTimeout(() => {
        startWork()
        this.workTimer.start()
      }, 1000)
    })
  }

  function renderStatusText(text) {
    document.querySelector('.status').innerText = text
  }

  function setProgress(progress, currentTimerText) {
    this.state.progress = progress
    if (this.state.status === 'work') {
      this.state.currentWorkText = currentTimerText
    } else {
      this.state.currentBreakText = currentTimerText
    }
    renderPomodoro()
    renderPomodoroText()
  }

  function renderPomodoro() {
    this.pomodoro.update(this.state.progress)
  }

  function renderPomodoroText() {
    var timerTextElem = document.querySelector('.info-circle span')
    if (this.state.status === 'work') {
      timerTextElem.innerText = this.state.currentWorkText
    } else {
      timerTextElem.innerText = this.state.currentBreakText
    }
  }

  function renderTheme(themeColor) {
    this.state.themeColor = themeColor
    document.querySelector('.info-circle').style.backgroundColor = themeColor
    document.querySelector('.base-circle').style.backgroundColor = themeColor + '2b'
    this.pomodoro.updateColor(themeColor, this.state.progress)
    renderButtons()
  }

  function renderButtons() {
    document.querySelectorAll('.button')
      .forEach(elem => {
        elem.style.background = this.state.themeColor
      })

    document.querySelectorAll('.button-label, .button-time')
      .forEach(elem => {
        elem.style.color = this.state.themeColor
      })
  }

  function disableButtons() {
    this.state.isButtonsDisable = true
    document.querySelectorAll('.button, .button-time, .button-label')
      .forEach(elem => {
        elem.classList.add('disable')
      })
  }
  function enableButtons() {
    this.state.isButtonsDisable = false
    document.querySelectorAll('.button, .button-time, .button-label')
      .forEach(elem => {
        elem.classList.remove('disable')
      })
  }


  function updateWorkPomodoro() {
    this.state.currentWorkText = convertReadableMS(this.state.workTimerLimit * 60 * 1000)
    document.querySelector('.button-time.work')
      .innerText = this.state.workTimerLimit
    this.pomodoro.update(1)
    renderPomodoroText()
    if (this.state.status === 'work') {
      startWork()
    }
  }

  function updateBreakPomodoro() {
    this.state.currentBreakText = convertReadableMS(this.state.breakTimerLimit * 60 * 1000)
    document.querySelector('.button-time.break')
      .innerText = this.state.breakTimerLimit
    renderPomodoroText()
    if (this.state.status === 'break') {
      startBreak()
    }
  }

  this.handleWorkPlusClick = function() {
    if (!this.state.isButtonsDisable) {
      this.state.workTimerLimit = this.state.workTimerLimit + 1
      updateWorkPomodoro()
    }
  }


  this.handleWorkMinusClick = function() {
    if (!this.state.isButtonsDisable && this.state.workTimerLimit > 1) {
      this.state.workTimerLimit = this.state.workTimerLimit - 1
      updateWorkPomodoro()
    }
  }

  this.handleBreakPlusClick = function() {
    if (!this.state.isButtonsDisable) {
      this.state.breakTimerLimit = this.state.breakTimerLimit + 1
      updateBreakPomodoro()
    }
  }

  this.handleBreakMinusClick = function() {
    if (!this.state.isButtonsDisable) {
      this.state.breakTimerLimit = this.state.breakTimerLimit - 1
      updateBreakPomodoro()
    }
  }

  function initTimerText() {
    document.querySelector('.button-time.work').innerText = this.state.workTimerLimit
    document.querySelector('.button-time.break').innerText = this.state.breakTimerLimit
  }

  initTimerText()
  document.querySelector('.plus-button.work')
    .addEventListener('click', handleWorkPlusClick.bind(this))
  document.querySelector('.minus-button.work')
    .addEventListener('click', handleWorkMinusClick.bind(this))
  document.querySelector('.plus-button.break')
    .addEventListener('click', handleBreakPlusClick.bind(this))
  document.querySelector('.minus-button.break')
    .addEventListener('click', handleBreakMinusClick.bind(this))
  document.querySelector('#play-button')
    .addEventListener('click', () => {
        this.handlePausePlay()
    })
  document.querySelector('#replay-button')
    .addEventListener('click', () => {
      const shouldPlay = this.breakTimer
        ? this.workTimer.state === 1 || this.breakTimer.state === 1
        : this.workTimer.state === 1
      if (this.state.status === 'break') {
        this.breakTimer.stop()
        renderTheme(color.stroke)
        renderStatusText(l10n.get('work'))
        startWork()
        if (shouldPlay) {
          this.workTimer.start()
        }
      }
      if (shouldPlay) {
        this.handlePausePlay()
        updateWorkPomodoro()
        this.handlePausePlay()
      } else {
        updateBreakPomodoro()
      }
    })
}

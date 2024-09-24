// Function to get a parameter by name from the URL

document.addEventListener('DOMContentLoaded', async function() {
  var calendarEl = document.getElementById('calendar');
  const slugParam = getUrlParameter('slug');
  const backButton = document.getElementById('back-link');

  const activities = await getActivities(slugParam);
  const eventSchedules = getSchedule(activities);
  const filteredEvent = filterInvalidEvent(eventSchedules);
  
  const listEvent = filteredEvent.map(i => ({
    title: i.location_name,
    start: moment(i.start).format('YYYY-MM-DDTHH:mm:ss'),
    end: moment(i.end).format('YYYY-MM-DDTHH:mm:ss'),
    description: i.location_description || "",
    location: i.address,
    displayTime: `${moment(i.start).format("ddd, MMM DD")}
              <span>${moment(i.start).format(
                "h:mm a",
              )} -  ${moment(i.end).format("h:mm a")}</span>`
  }));

  backButton.addEventListener("click", function() {
    window.open(`https://gotruckster.com/food-truck/${slugParam}`, '_blank').focus();
  })
  
  // Initialize FullCalendar
  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: listEvent,
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,dayGridWeek,dayGridDay'
    },
    eventDidMount: function(info) {
      // Set up hover event for the custom tooltip
      info.el.addEventListener('mouseenter', function() {
          tooltip.style.display = 'block';
          tooltip.innerHTML = `
              <strong>${info.event.title}</strong><br>
              <p>${info.event.extendedProps.location}</p>
              ${info.event.extendedProps.displayTime}
          `;
      });

      info.el.addEventListener('mousemove', function(event) {
          // Position the tooltip based on mouse movement
          tooltip.style.left = event.pageX + 10 + 'px';
          tooltip.style.top = event.pageY + 10 + 'px';
      });

      info.el.addEventListener('mouseleave', function() {
          tooltip.style.display = 'none';
      });
    }
  });

  // Render the calendar
  calendar.render();
});

function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function getActivities(slug) {
// Call the API to fetch event data
  return fetch(`https://mq5pxvdddgl4qra62ab7ysq5sq0qvdqj.lambda-url.us-west-2.on.aws/?slug=${slug}&calendar=true`, {headers: {
          'Accept': 'application/json, text/plain',
          'Content-Type': 'application/json;charset=UTF-8'
      },})
      .then(response => {
          if (!response.ok) {
              throw new Error('Network response was not ok ' + response.statusText);
          }
          return response.json();
      })
      .then(res => res.data)
      .catch(error => {
          console.error('Error fetching events:', error);
          failureCallback(error);
      });
}

function parseTZDateToLocal ({ date, format = undefined, timezone }) {
  const tzDate = parseDateWithTZ({ date, format, timezone });

  return tzDate.local();
};

function parseDateWithTZ({ date, format = undefined, timezone }) {
  let zone = timezone;
  
  if (!timezone || window.TIME_ZONES_LIST.indexOf(`${zone}`.toLowerCase()) < 0) {
    zone = "America/Denver";
  }
  return format ? moment.tz(date, format, zone) : moment.tz(date, zone);
};

const TIME_REPEATED = {
  DAY: 365,
  WEEK: 100,
  MONTH: 100,
};

function getSchedule(data, onlyGetFutureEvent = false) {
  let schedules = [];
  (data || []).forEach((calendarItem) => {
    let { timezone, frequency = {}, end_time, start_time } = calendarItem;

    const end = parseTZDateToLocal({
      date: end_time,
      format: "YYYY-MM-DD HH:mm:ss",
      timezone,
    });
    const start = parseTZDateToLocal({
      date: start_time,
      format: "YYYY-MM-DD HH:mm:ss",
      timezone,
    });
    switch (frequency.name) {
      case "DAILY": {
        //Get day of pairing of the week
        let interval = calendarItem.interval ? calendarItem.interval : 1;
        let repeated = calendarItem.times_repeated
          ? calendarItem.times_repeated + 1
          : TIME_REPEATED.DAY;

        // get duration for event with repeated > 365
        const duration = moment.duration(moment().diff(moment(start))).asDays();
        const ignoreDays =
          repeated === TIME_REPEATED.DAY && duration > TIME_REPEATED.DAY
            ? Math.floor(duration / TIME_REPEATED.DAY) * TIME_REPEATED.DAY
            : 0;

        for (let i = 0; i < repeated; ++i) {
          const endInstance = moment(end).add(ignoreDays + i * interval, "day"),
            startInstance = moment(start).add(ignoreDays + i * interval, "day");

          // TODO: refactoring this
          schedules.push({
            ...calendarItem,
            timeDisplay: endInstance.local().format("YYYY-MM-DD h:mm a"),
            start: startInstance.toDate(),
            end: endInstance.toDate(),
            mmDate: endInstance.unix(),
          });
        }

        break;
      }
      case "WEEKLY": {
        //Get day of pairing of the week
        const interval = calendarItem.interval || 1;
        const repeated = calendarItem.times_repeated
          ? calendarItem.times_repeated + 1
          : TIME_REPEATED.WEEK;

        // get duration for event with repeated > week number
        const duration = moment.duration(moment().diff(moment(start))).asWeeks();
        const ignoreWeeks =
          repeated === TIME_REPEATED.WEEK && duration > TIME_REPEATED.WEEK
            ? Math.floor(duration / TIME_REPEATED.WEEK) * TIME_REPEATED.WEEK
            : 0;

        for (let i = 0; i < repeated; ++i) {
          let endInstance = moment(end).add(ignoreWeeks + i * interval, "w"),
            startInstance = moment(start).add(ignoreWeeks + i * interval, "w");

          schedules.push({
            ...calendarItem,
            timeDisplay: endInstance.local().format("YYYY-MM-DD h:mm a"),
            start: startInstance.toDate(),
            end: endInstance.toDate(),
            mmDate: endInstance.unix(),
          });
        }

        break;
      }
      case "MONTHLY": {
        let interval = calendarItem.interval || 1;
        let repeated = calendarItem.times_repeated
          ? calendarItem.times_repeated + 1
          : TIME_REPEATED.MONTH;

        // get duration for event with repeated > month number
        const duration = moment.duration(moment().diff(moment(start))).asMonths();
        const ignoreMonths =
          repeated === TIME_REPEATED.MONTH && duration > TIME_REPEATED.MONTH
            ? Math.floor(duration / TIME_REPEATED.MONTH) * TIME_REPEATED.MONTH
            : 0;

        for (let j = 0; j < repeated; ++j) {
          const startInstance = moment(start).add(ignoreMonths + j * interval, "M");
          const endInstance = moment(end).add(ignoreMonths + j * interval, "M");

          const scheduleItem = {
            ...calendarItem,
            timeDisplay: endInstance.local().format("YYYY-MM-DD h:mm a"),
            start: startInstance.toDate(),
            end: endInstance.toDate(),
            mmDate: endInstance.unix(),
          };

          schedules.push(scheduleItem);
        }

        break;
      }
      case undefined:
      case "ONCE":
      default: {
        schedules.push({
          ...calendarItem,
          timeDisplay: end.local().format("YYYY-MM-DD h:mm a"),
          start: start.toDate(),
          end: end.toDate(),
          // For ez comparision
          mmDate: end.unix(),
        });
        break;
      }
    }
  });

  if (onlyGetFutureEvent) {
    let futureEvents = [];
    schedules.forEach((item) => {
      if (isFutureEvent(item.end)) futureEvents.push(item);
    });
    return futureEvents;
  }
  return schedules;
}

const filterNowSchedule = (schedule) => {
  // Get now time stamp
  const nowUnix = moment().unix();

  return (schedule || []).filter((event) => {
    let valid = false;
    if (
      event["latitude"] &&
      event["longtitude"] &&
      Number(event["latitude"]) !== -1 &&
      Number(event["longtitude"]) !== -1
    ) {
      if (moment(event.start).unix() <= nowUnix && moment(event.end).unix() >= nowUnix) {
        valid = true;
      } else if (event.pre_ordering) {
        const duration = moment.duration(moment(event.start).diff(moment()));

        valid = duration.asHours() <= 72 && duration.asHours() > 0;
      }
    }

    return valid;
  });
};

const filterInvalidEvent = (list) => {
  return list.filter((i) => {
    let lng = parseInt(i.longtitude);
    let lat = parseInt(i.latitude);

    return i.address && lng && lat && lng !== 0 && lng !== -1 && lat !== 0 && lat !== -1;
  });
};
import { templates, select, settings, classNames } from '../settings.js';
import { utils } from '../utils.js';
import AmountWidget from './AmountWidget.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';


class Booking {
  constructor(bookingWidgetContainer) {
    const thisBooking = this;

    thisBooking.selectedTable = null;
    thisBooking.render(bookingWidgetContainer);
    thisBooking.initWidgets();
    thisBooking.getData();
    thisBooking.dom.availabilityRangeSlider = document.querySelector('#availability');
    thisBooking.open = 12;
    thisBooking.close = 24;
    thisBooking.date = '2019-01-01';


  }

  getData() {
    const thisBooking = this;

    const startDateParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePicker.minDate);
    const endDateParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePicker.maxDate);
    const params = {
      booking: [
        startDateParam,
        endDateParam,
      ],
      eventsCurrent: [
        settings.db.notRepeatParam,
        startDateParam,
        endDateParam,
      ],
      eventsRepeat: [
        settings.db.repeatParam,
        endDateParam,
      ],
    };

    // console.log('getData params', params);

    const urls = {
      booking: settings.db.url + '/' + settings.db.booking
        + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.event
        + '?' + params.eventsCurrent.join('&'),
      eventsRepeat: settings.db.url + '/' + settings.db.event
        + '?' + params.eventsRepeat.join('&'),
    };

    // console. ('getData urls', urls);

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
      .then(function (allResponse) {
        const bookingsResponse = allResponse[0];
        const eventsCurrentResponse = allResponse[1];
        const eventsRepeatResponse = allResponse[2];
        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),
        ]);
      })
      .then(function ([bookings, eventsCurrent, eventsRepeat]) {
        // console.log(bookings);
        // console.log(eventsCurrent);
        // console.log(eventsRepeat);
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat) {
    const thisBooking = this;

    thisBooking.booked = {};

    for (let item of bookings) {
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    for (let item of eventsCurrent) {
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    const minDate = thisBooking.datePicker.minDate;
    const maxDate = thisBooking.datePicker.maxDate;

    for (let item of eventsRepeat) {
      if (item.repeat == 'daily') {
        for (let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)) {
          thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }
      }
    }
    // console.log('thisBooking.booked', thisBooking.booked);

    thisBooking.updateDOM();
    thisBooking.initTableAvailability();
  }

  makeBooked(date, hour, duration, table) {
    const thisBooking = this;

    if (typeof thisBooking.booked[date] == 'undefined') {
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);

    for (let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5) {
      // console.log('loop', hourBlock);

      if (typeof thisBooking.booked[date][hourBlock] == 'undefined') {
        thisBooking.booked[date][hourBlock] = [];
      }

      thisBooking.booked[date][hourBlock].push(table);
    }
  }

  initTableAvailability() {
    const thisBooking = this;

    console.log(thisBooking.booked);

    const tableAvailability = [];
    for (let i = thisBooking.open; i < thisBooking.close; i += 0.5) {
      if (thisBooking.booked[thisBooking.date][i]) {
        thisBooking.booked[thisBooking.date][i].push[thisBooking.table];
      } else {
        thisBooking.booked[thisBooking.date][i] = [];
      }
      tableAvailability.push(thisBooking.booked[thisBooking.date][i].length);
    }

    for (let i = 0; i < tableAvailability.length; i++) {
      const divRangeSlider = document.createElement('div');
      divRangeSlider.classList.add('availability-div');
      if (tableAvailability[i] === 1 || tableAvailability[i] === 2) {
        divRangeSlider.classList.add('medium');
      } else if (tableAvailability[i] === 3) {
        divRangeSlider.classList.add('full');
      } else {
        divRangeSlider.classList.add('empty');
      }
      thisBooking.dom.availabilityRangeSlider.appendChild(divRangeSlider);
    }
  }


  updateDOM() {
    const thisBooking = this;
    
    console.log(thisBooking.booked);


    thisBooking.date = thisBooking.datePicker.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    if (thisBooking.selectedTable) {
      for (let table of thisBooking.dom.tables) {
        table.classList.remove(classNames.booking.tableActive);
      }
      const activeTable = thisBooking.dom.wrapper.querySelector('.table[data-table="' + this.selectedTable + '"]');
      activeTable.classList.add(classNames.booking.tableActive);
    } else {
      for (let table of thisBooking.dom.tables) {
        table.classList.remove(classNames.booking.tableActive);
      }
    }

    let allAvailable = false;

    if (
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ) {
      allAvailable = true;
    }

    for (let table of thisBooking.dom.tables) {
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);

      if (!isNaN(tableId)) {
        tableId = parseInt(tableId);
      }

      if (
        !allAvailable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
      ) {
        table.classList.add(classNames.booking.tableBooked);
      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }
  }

  render(bookingWidgetContainer) {
    const thisBooking = this;

    /* generate HTML based on template */
    const generatedHTML = templates.bookingWidget();
    thisBooking.dom = {};
    thisBooking.dom.wrapper = bookingWidgetContainer;
    thisBooking.dom.wrapper.innerHTML = generatedHTML;

    thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(select.booking.peopleAmount);
    thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(select.booking.hoursAmount);
    thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
    thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);
    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);

    thisBooking.dom.inputAddress = thisBooking.dom.wrapper.querySelector(select.booking.address);
    thisBooking.dom.inputPhone = thisBooking.dom.wrapper.querySelector(select.booking.phone);
    thisBooking.dom.inputStarters = thisBooking.dom.wrapper.querySelectorAll(select.booking.starters);
    thisBooking.dom.form = thisBooking.dom.wrapper.querySelector(select.booking.form);

  }

  initWidgets() {
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);

    thisBooking.dom.wrapper.addEventListener('updated', function () {
      thisBooking.updateDOM();
    });

    thisBooking.dom.datePicker.addEventListener('updated', function () {
      thisBooking.selectedTable = null;
      thisBooking.updateDOM();
    });

    thisBooking.dom.hourPicker.addEventListener('updated', function () {
      thisBooking.selectedTable = null;
      thisBooking.updateDOM();
    });

    for (let table of thisBooking.dom.tables) {
      table.addEventListener('click', function () {
        if (table.classList.contains('booked')) {
          return;
        }
        thisBooking.selectedTable = parseInt(table.dataset.table);
        thisBooking.updateDOM();
      });
    }

    thisBooking.dom.form.addEventListener('submit', function(event){
      event.preventDefault();
      thisBooking.sendBooking();
    });
  }

  sendBooking() {
    const thisBooking = this;

    if(!thisBooking.selectedTable){
      alert('Pick a table');
      return;
    }

    const url = settings.db.url + '/' + settings.db.booking;

    const payload = {
      table: thisBooking.selectedTable,
      date: thisBooking.datePicker.value,
      hour: thisBooking.hourPicker.value,
      ppl: thisBooking.peopleAmount.value,
      duration: thisBooking.hoursAmount.value,
      starters: [],
      address: thisBooking.dom.inputAddress.value,
      phone: thisBooking.dom.inputPhone.value,
    };

    for(let starter of thisBooking.dom.inputStarters){
      if(starter.checked == true){
        payload.starters.push(starter.value);
      }
    }

   
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    fetch(url, options)
      .then(function (response) {
        return response.json();
      })
      .then(function () {
        thisBooking.selectedTable = null;
        thisBooking.makeBooked(payload.date, payload.hour, payload.duration, payload.table);
        thisBooking.updateDOM();
      });
  }
}

export default Booking;
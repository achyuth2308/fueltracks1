import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const CustomDatePicker = ({ value, onChange, style, max, showTime }) => {
  // Convert string 'YYYY-MM-DD' or 'YYYY-MM-DDThh:mm' to Date object
  let selectedDate = null;
  if (value) {
    if (showTime && value.includes('T')) {
      const [datePart, timePart] = value.split('T');
      const [y, m, d] = datePart.split('-');
      const [hr, min] = timePart.split(':');
      if (y && m && d && hr && min) {
        selectedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hr), parseInt(min));
      }
    } else {
      const [y, m, d] = value.split('T')[0].split('-');
      if (y && m && d) {
        selectedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      }
    }
  }

  let maxDate = null;
  if (max) {
    const [y, m, d] = max.split('T')[0].split('-');
    if (y && m && d) {
      maxDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
  }

  const handleChange = (date) => {
    if (!date) {
      onChange({ target: { value: '' } });
      return;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (showTime) {
      const hr = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      onChange({ target: { value: `${year}-${month}-${day}T${hr}:${min}` } });
    } else {
      onChange({ target: { value: `${year}-${month}-${day}` } });
    }
  };

  const defaultStyle = {
    width: '100%', 
    padding: '10px 14px', 
    borderRadius: '10px', 
    border: '1px solid #CBD5E1', 
    outline: 'none', 
    boxSizing: 'border-box', 
    color: '#000000',
    fontFamily: 'inherit',
    ...style
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      dateFormat={showTime ? "dd-MM-yyyy h:mm aa" : "dd-MM-yyyy"}
      showTimeSelect={showTime}
      maxDate={maxDate}
      customInput={<input style={defaultStyle} />}
    />
  );
};

export default CustomDatePicker;

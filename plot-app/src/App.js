import React from 'react';
import Plotly from 'plotly.js';
import createPlotlyComponent from 'react-plotly.js/factory';
import Papa from 'papaparse';
import moment from 'moment';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import { simulate, sir } from './sir';

const Plot = createPlotlyComponent(Plotly);

// Root Mean Square Error function
function RMSE(predicted, actual) {
  let total = 0;

  for (let i = 0; i < actual.length; i++) {
    total = Math.pow(predicted[i] - actual[i], 2);
  }

  return Math.sqrt(total / actual.length);
}

// Get data from CSV
async function getData(dataCSV) {
  return new Promise(resolve => {
    Papa.parse(dataCSV, {
      header: true,
      download: true,
      complete: results => {
        console.log('Complete', results.data.length, 'records.'); 
        resolve(results.data);
      }
    });
  });
};

// Get Header from CSV
async function getHeader(dataCSV) {
  return new Promise(resolve => {
    Papa.parse(dataCSV, {
      preview: 1,
      download: true,
      complete: results => {
        console.log('Complete', results.data.length, 'records.'); 
        resolve(results.data);
      }
    });
  });
};

// Filter by Country
function filterCountry(data) {
  return data['Country/Region'] === this;
}

// Create new trace with given name and colour
function newTrace(name, color) {
  return {
    x: [],
    y: [],
    name,
    line: {
      color,
      width: 3
    }
  };
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.covidHeader = null;
    this.covidCases = null;
    this.covidDeaths = null;
    this.covidRecovered = null;
    this.populationData = null;
    this.countries = new Set();

    this.state = {
      country: "Australia",
      proportion: 0.001,
      explicitPolulation: false,
      population: 0,
      susceptiplePop: 0,
      traces: [
        newTrace("Cases", "purple"),
        newTrace("Deaths", "orange"),
        newTrace("Recovered", "lime"),
        newTrace("Recovered + Deaths", "grey"),
        newTrace("Susceptible", "blue"),
        newTrace("Infected", "red"),
        newTrace("Recovered", "green"),
      ],
      layout: {
        datarevision: 0,
        width: 900,
        height: 700,
        title: "COVID-19 Australia"
      },
      revision: 0
    };

    this.handleCountryChange = this.handleCountryChange.bind(this);
    this.handleCountrySubmit = this.handleCountrySubmit.bind(this);
    this.handleProportionChange = this.handleProportionChange.bind(this);
    this.handleProportionSubmit = this.handleProportionSubmit.bind(this);
    this.handleExplicitPopChange = this.handleExplicitPopChange.bind(this);
    this.handleExplicitPopSubmit = this.handleExplicitPopSubmit.bind(this);
  }

  // Set values for intial state to Australia
  async componentDidMount() {
    const covidCasesCSV = require("./datasets/covid_cases.csv");
    const covidDeathsCSV = require("./datasets/covid_deaths.csv");
    const covidRecoveredCSV = require("./datasets/covid_recovered.csv");
    const populationCSV = require("./datasets/population.csv");

    // Get data from CSVs
    this.covidCases = await getData(covidCasesCSV);
    this.covidDeaths = await getData(covidDeathsCSV);
    this.covidRecovered = await getData(covidRecoveredCSV);
    this.populationData = await getData(populationCSV);
    this.covidHeader = await getHeader(covidCasesCSV);
    this.covidHeader = this.covidHeader[0];

    // Get all countries/regions
    for (let i = 0; i < this.covidCases.length; i++) {
      if (this.covidCases[i]['Country/Region']) {
        this.countries.add(this.covidCases[i]['Country/Region']);
      }
    }
    
    // Set trace for Australia
    this.setCountryTraces();
  }

  // Set all traces for country in current state
  async setCountryTraces() {
    const {traces, layout} = this.state;
    const filteredCovidCases = this.covidCases.filter(filterCountry, this.state.country);
    const filteredCovidDeaths = this.covidDeaths.filter(filterCountry, this.state.country);
    const filteredCovidRecovered = this.covidRecovered.filter(filterCountry, this.state.country);
    const population = this.populationData.filter(filterCountry, this.state.country);

    console.log(population);

    if (population) {
      this.state.population = Number(population[0].Population);

      if (!this.state.explicitPolulation) {
        this.state.susceptiplePop = Math.round(this.state.population * this.state.proportion);
      }
    }

    for (const trace of traces) {
      trace.x = [];
      trace.y = [];
    }

    for (const header of this.covidHeader.slice(4)) {
      let casesSum = 0;
      let deathsSum = 0;
      let recoveredSum = 0;

      // Get formatted date from header dates
      const m = moment(header, "MM/DD/YY");
      const formattedDate = m.format("YYYY-MM-DD");

      // Sum all cases, deaths and recovered for current country
      for (let j = 0; j < filteredCovidCases.length; j++){
        casesSum += parseInt(filteredCovidCases[j][header]);
        deathsSum += parseInt(filteredCovidDeaths[j][header]);
        recoveredSum += parseInt(filteredCovidRecovered[j][header]);
      }

      if (casesSum > 0) {
        // Set x-axis to be these formatted dates
        for (const trace of traces.slice(0, 4)) {
          trace.x.push(formattedDate);
        }

        // Set all traces
        traces[0].y.push(casesSum - recoveredSum - deathsSum);
        traces[1].y.push(deathsSum);
        traces[2].y.push(recoveredSum);
        traces[3].y.push(recoveredSum + deathsSum);
      }
    }

    const t0 = traces[0];
    const t3 = traces[3];

    const S0 = this.state.susceptiplePop - t0.y[0] - t3.y[0];
    const I0 = t0.y[0];
    const R0 = t3.y[0];
  
    console.log([S0, I0, R0]);

    const init = [S0, I0, R0].map(x => x / this.state.susceptiplePop);

    console.log(init);
    
    const sol = simulate(sir(), 0, init, 1, 365);
    console.log(sol);

    const getDate = x => {
      const start = new Date(t0.x[0]);
      const date = new Date(start.getTime() + x * (24 * 60 * 60 * 1000));
      const m = moment(date.toISOString());
      return m.format("YYYY-MM-DD");
    };

    const i0 = traces.indexOf(traces.find(trace => trace.name === "Susceptible"));

    sol.y.forEach((ys, x) => {
      for (let i = i0; i < traces.length; i++) {
        traces[i].x.push(getDate(x));
        traces[i].y.push(Math.round(ys[i - i0] * this.state.susceptiplePop));
      }
    });

    console.log(traces);

    // Set title and revision status
    layout.title = `COVID-19 ${this.state.country}`;
    await this.setState({ revision: this.state.revision + 1 });
    layout.datarevision = this.state.revision + 1;
  }

  // Create select items for countries/regions
  createSelectItems() {
    let items = [];
    
    for (let item of this.countries) {
      items.push(<option key={item} value={item}>{item}</option>)
    }

    return items;
  }

  // Handle state change in country/region
  handleCountryChange(event) {
    this.setState({
      country: event.target.value,
      explicitPolulation: false
    });
  }

  // Handle a change submission of change in country/region
  handleCountrySubmit(event) {
    this.setCountryTraces();
    event.preventDefault();
  }

  // Handle state change for proportion susceptible
  handleProportionChange(event) {
    this.setState({
      proportion: event.target.value,
      explicitPolulation: false
    });
  }

  // Handle a change submission of proportion susceptible
  handleProportionSubmit(event) {
    this.setCountryTraces();
    event.preventDefault();
  }

  // Handle state change for population susceptible
  handleExplicitPopChange(event) {
    this.setState({
      susceptiplePop: event.target.value,
      explicitPolulation: true
    });
  }

  // Handle a change submission of population susceptible
  handleExplicitPopSubmit(event) {
    this.setCountryTraces();
    event.preventDefault();
  }

  render() {
    return (
      <div>
        <Plot
          data={this.state.traces}
          layout={this.state.layout}
          revision={this.state.revision}
        />
        <Form onSubmit={this.handleCountrySubmit}>
          <Form.Group as={Col} md="4">
            <Form.Label>Select a country:</Form.Label>
            <Form.Control as="select" value={this.state.country} onChange={this.handleCountryChange}>
              {this.createSelectItems()}
            </Form.Control>
            <br />
            <Button variant="primary" type="submit">
              Submit
            </Button>
          </Form.Group>
        </Form>
        <Form onSubmit={this.handleProportionSubmit}>
          <Form.Group as={Col} md="4">
            <Form.Label>Proportion of population that is susceptible:</Form.Label>
            <Form.Control 
              type="number"
              min={0}
              max={1}
              step={0.0001}
              value={this.state.proportion}
              onChange = {this.handleProportionChange}
              />
            <br />
            <Button variant="primary" type="submit">
              Submit
            </Button>
          </Form.Group>
        </Form>
        <Form onSubmit={this.handleExplicitPopSubmit}>
          <Form.Group as={Col} md="4">
            <Form.Label>Susceptible Population</Form.Label>
            <Form.Control 
              type="number"
              min={0}
              max={this.state.population}
              step={1}
              value={this.state.susceptiplePop}
              onChange = {this.handleExplicitPopChange}
              />
            <br />
            <Button variant="primary" type="submit">
              Submit
            </Button>
          </Form.Group>
        </Form>
      </div>
    );
  }
}

export default App;

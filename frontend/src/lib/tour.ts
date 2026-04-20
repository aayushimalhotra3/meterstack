export const TOUR_EVENT = 'meterstack:start-tour'

export function startGuidedTour() {
  window.dispatchEvent(new Event(TOUR_EVENT))
}

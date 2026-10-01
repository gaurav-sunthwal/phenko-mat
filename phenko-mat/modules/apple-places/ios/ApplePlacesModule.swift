import ExpoModulesCore
import MapKit

struct PlaceSuggestion: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var subtitle: String = ""
}

struct ResolvedPlace: Record {
  @Field var lat: Double = 0
  @Field var lng: Double = 0
  @Field var area: String = ""
}

/// Location search on iOS with Apple Maps: MKLocalSearchCompleter for suggestions while typing,
/// MKLocalSearch to turn a picked suggestion into coordinates and an area name. No API key needed.
public class ApplePlacesModule: Module {
  private var search: PlaceSearch?

  public func definition() -> ModuleDefinition {
    Name("ApplePlaces")

    AsyncFunction("autocomplete") { (query: String, lat: Double?, lng: Double?) async throws -> [PlaceSuggestion] in
      let search = await self.placeSearch()
      return try await search.complete(query, near: lat.flatMap { la in lng.map { CLLocationCoordinate2D(latitude: la, longitude: $0) } })
    }

    AsyncFunction("resolve") { (id: String) async throws -> ResolvedPlace in
      let search = await self.placeSearch()
      return try await search.resolve(id)
    }
  }

  @MainActor
  private func placeSearch() -> PlaceSearch {
    if let search { return search }
    let created = PlaceSearch()
    search = created
    return created
  }
}

@MainActor
final class PlaceSearch: NSObject, MKLocalSearchCompleterDelegate {
  private let completer = MKLocalSearchCompleter()
  private var waiting: CheckedContinuation<[MKLocalSearchCompletion], Error>?
  /// Completions from the latest results, by the id handed to JS (needed to resolve a pick).
  private var byId: [String: MKLocalSearchCompletion] = [:]

  override init() {
    super.init()
    completer.delegate = self
    completer.resultTypes = [.address, .pointOfInterest]
  }

  func complete(_ query: String, near: CLLocationCoordinate2D?) async throws -> [PlaceSuggestion] {
    // A newer keystroke supersedes the previous request.
    waiting?.resume(returning: [])
    waiting = nil
    if let near {
      completer.region = MKCoordinateRegion(center: near, latitudinalMeters: 100_000, longitudinalMeters: 100_000)
    }

    let results: [MKLocalSearchCompletion]
    if completer.queryFragment == query && !completer.isSearching {
      results = completer.results  // Same text again: the delegate won't fire, reuse what we have.
    } else {
      results = try await withCheckedThrowingContinuation { continuation in
        waiting = continuation
        completer.queryFragment = query
      }
    }

    byId = [:]
    return results.prefix(8).map { completion in
      let id = "\(completion.title)\u{1F}\(completion.subtitle)"
      byId[id] = completion
      let s = PlaceSuggestion()
      s.id = id
      s.title = completion.title
      s.subtitle = completion.subtitle
      return s
    }
  }

  func resolve(_ id: String) async throws -> ResolvedPlace {
    let request: MKLocalSearch.Request
    if let completion = byId[id] {
      request = MKLocalSearch.Request(completion: completion)
    } else {
      request = MKLocalSearch.Request()
      request.naturalLanguageQuery = id.replacingOccurrences(of: "\u{1F}", with: ", ")
    }
    let response = try await MKLocalSearch(request: request).start()
    guard let item = response.mapItems.first else {
      throw Exception(name: "PlaceNotFound", description: "Couldn't find that place.")
    }
    let placemark = item.placemark
    let local = placemark.subLocality ?? item.name ?? placemark.name
    let city = placemark.locality ?? placemark.subAdministrativeArea
    var parts: [String] = []
    for part in [local, city] {
      if let part, !part.isEmpty, !parts.contains(part) { parts.append(part) }
    }
    let place = ResolvedPlace()
    place.lat = placemark.coordinate.latitude
    place.lng = placemark.coordinate.longitude
    place.area = String(parts.joined(separator: ", ").prefix(80))
    return place
  }

  nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    Task { @MainActor in
      self.waiting?.resume(returning: completer.results)
      self.waiting = nil
    }
  }

  nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    Task { @MainActor in
      // "No results" arrives as an error from MapKit; treat it as an empty list.
      if (error as NSError).code == MKError.placemarkNotFound.rawValue {
        self.waiting?.resume(returning: [])
      } else {
        self.waiting?.resume(throwing: error)
      }
      self.waiting = nil
    }
  }
}

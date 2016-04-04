import _ from 'lodash'

const SpatialUtil = {

  spatialTypeRegex: /^(\w+)(?:\((\w+), (\d+)\))?$/,

  /**
   * Get the version of the installed postgis extension
   */
  getPostgisVersion (cxn) {
    return cxn.knex
      .raw('select postgis_lib_version()')
      .then(({ rows: [{ version }] }) => {
        return version.split('.')
      })
  },

  /**
   * Parse and validate the installed postgis version
   * (must be newer than 2.1)
   */
  validatePostgisVersion ([ major, minor, patch ]) {
    if (major < 2 || (major == 2 && minor < 1)) {
      throw new Error(`
        PostGIS ${major}.${minor}.${patch} detected. This adapter requires PostGIS 2.1 or higher.
        Please either:
        1. Upgrade your PostGIS extension to at least 2.1.0
        2. Disable the spatial extension on this adapter (see README)
      `)
    }

    return parseFloat(`${major}.${minor}`)
  },

  /*
  addGeometryColumns (cxn, tableName, tableDefinition) {
    let geometryColumns = _.chain(tableDefinition)
      .pick(SpatialUtil.isSpatialColumn)
      .map((attr, name) => {
        return SpatialUtil.addGeometryColumn(cxn, tableName, name, attr)
      })
      .value()

    return Promise.all(geometryColumns)
  },
  */

  /**
   * Add a geometry column to a table
   * http://postgis.net/docs/AddGeometryColumn.html
  addGeometryColumn (cxn, tableName, attributeName, definition) {
    let columnName = attributeName || definition.columnName
    let srid = definition.srid || 4326

    return cxn.knex.raw(`
      select AddGeometryColumn('${tableName}', '${columnName}', ${srid}, 'GEOMETRY', 2)
    `)
  },
   */

  /**
   * Convert geojson into postgis 'geometry' type. Re-project geometry if necessary.
   *
   * http://postgis.net/docs/ST_GeomFromGeoJSON.html
   * http://postgis.org/docs/ST_Transform.html
   */
  fromGeojson (geojson, definition, cxn) {
    if (_.isEmpty(geojson)) return

    let obj = _.isString(geojson) ? JSON.parse(geojson) : geojson
    let geometry = obj.geometry || obj

    _.defaultsDeep(geometry, {
      crs: {
        type: 'name',
        properties: {
          name: 'EPSG:' + SpatialUtil.getDeclaredSrid(geometry, definition)
        }
      }
    })

    return cxn.st.transform(
      cxn.st.geomFromGeoJSON(geometry),
      SpatialUtil.getNativeSrid(definition)
    )
  },

  /**
   * Get "declared srid". This is the SRID that we're expecting of geometries
   * that we're inserting into the database.
   */
  getDeclaredSrid (geometry, definition) {
    let [ $, declaredSrid ] = (_.get(geometry, [ 'crs', 'properties', 'name' ]) || '').split(':')
    return declaredSrid || SpatialUtil.getNativeSrid(definition)
  },

  /**
   * Get "native srid". This is the SRID that we're using to store geometries
   * in the database.
   *
   * examples:
   *  geometry(Point, 4326)
   */
  getNativeSrid (definition) {
    let [ $, dbType, geoType, srid ] = SpatialUtil.spatialTypeRegex.exec(definition.dbType)
    return srid || 0
  },

  buildSpatialSelect (tableDefinition, tableName, cxn) {
    return _.map(SpatialUtil.getSpatialColumns(tableDefinition), (definition, attr) => {
      return cxn.st.asGeoJSON(`${tableName}.${attr}`).as(attr)
    })
  },

  getSpatialColumns (tableDefinition) {
    return _.pickBy(tableDefinition, SpatialUtil.isSpatialColumn)
  },

  hasSpatialColumn (tableDefinition) {
    return !!_.find(tableDefinition, SpatialUtil.isSpatialColumn)
  },

  isSpatialColumn (definition) {
    if (!definition || !definition.dbType) return false

    let [ $, dbType, geoType, srid ] = SpatialUtil.spatialTypeRegex.exec(definition.dbType) || [ ]
    return dbType === 'geometry'
  }
}

export default SpatialUtil

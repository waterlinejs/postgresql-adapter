import assert from 'assert'
import SpatialUtil from '../../lib/spatial'

describe('SpatialUtil', () => {

  describe('#isSpatialColumn', () => {

    it('should return true for spatial column [ geometry(Point, 4326) ]', () => {
      let isSpatialColumn = SpatialUtil.isSpatialColumn({
        dbType: 'geometry(Point, 4326)'
      })

      assert(isSpatialColumn)
    })
    it('should return false for non-spatial column [ string ]', () => {
      let isSpatialColumn = SpatialUtil.isSpatialColumn({
        type: 'string'
      })

      assert(!isSpatialColumn)
    })

  })

  describe('#getNativeSrid', () => {

    it('should extract SRID from geometry(Point, 4326)', () => {
      let srid = SpatialUtil.getNativeSrid({
        dbType: 'geometry(Point, 4326)'
      })
      assert.equal(srid, 4326)
    })
    it('should extract SRID from geometry(Linestring, 3857)', () => {
      let srid = SpatialUtil.getNativeSrid({
        dbType: 'geometry(Linestring, 3857)'
      })
      assert.equal(srid, 3857)
    })
    it('should extract SRID from geography(GEOMETRYCOLLECTION, 4326)', () => {
      let srid = SpatialUtil.getNativeSrid({
        dbType: 'geography(GEOMETRYCOLLECTION, 4326)'
      })
      assert.equal(srid, 4326)
    })
  })
})
